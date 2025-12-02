import { RfidInterface } from "../rfid-interface";
import {
  buildByteValue,
  byteToHex,
  CRC16Modbus,
  delayExec,
  log,
} from "../tools";

const WY_STATUS_MAP = {
  success: { code: "00" }, // 操作成功
  finish: { code: "01" }, // 命令执行结束，同时返回询查到的电子标签数据
  overTime: { code: "02", msg: "Inquiry timeout" }, // 询查时间结束，命令执行强制退出，同时返回已询查到的标签数据
  extend: { code: "03" }, // 如果读到的标签数量无法在一条消息内传送完，将分多次发送。如果Status为0x03，则表示这条数据结束后，还有数据。
  overNumber: { code: "04", msg: "Tag quantity exceeded limit" }, // 还有电子标签未读取，电子标签数量太多，读写器的存储区已满，返回此状态值，同时返回已询查到得电子标签数据。
  aerial: {
    code: "f8",
    msg: "Please check if the antenna is correctly connected to position 1.",
  }, // 天线连接检测错误，当前天线连接可能已经断开。
  params: { code: "ff", msg: "Parameter error" }, // 参数错误
};

export class RfidWYuan extends RfidInterface {
  // 实例
  baudRate = 57600;
  port = null;
  writer = null;
  reader = null;
  scanning = false;
  splicing = []; // 行进中的

  // 连接设备
  async connect(success, error) {
    try {
      const port = await this.getPort();
      if (!port.opened) await port.open({ baudRate: this.baudRate });
      const writer = port.writable.getWriter();
      const reader = port.readable.getReader();
      this.port = port;
      this.writer = writer;
      this.reader = reader;
      if (success) success();
      log("串口已连接");
    } catch (e) {
      if (error) error(e);
    }
  }

  // 发送命令，举例：地址0x00，命令0x10，Data=[0x01, 0x02]
  async sendCommand(adr, cmd, data = [], process, error, options) {
    try {
      if (!this.writer)
        return success && success({ msg: "Please connect the device first." });
      this.scanning = true;
      while (this.scanning) {
        const cmdByte = this.buildCommand(adr, cmd, data);
        await this.writer.write(cmdByte);
        log(byteToHex(cmdByte), "发送");
        await this.readResponse(process, error);
        await delayExec(100);
      }
    } catch (e) {
      log(e);
      if (error) error({ code: "JS", msg: String(e) });
      this.scanStop();
    }
  }

  // 读取结果
  async readResponse(process, error) {
    try {
      // 等待结果返回
      const result = [];
      let fullLen = null;
      while (this.port?.readable && this.scanning) {
        const { value, done } = await this.reader.read();
        if (done || !value) return;
        if (!result.length) fullLen = Number(value[0]) + 1; // +1取整体长度+Len本身的长度
        const formatValue = byteToHex(value);
        result.push(...formatValue);
        if (result.length === fullLen) {
          if (
            result[3] === WY_STATUS_MAP.finish.code ||
            result[3] === WY_STATUS_MAP.success.code
          ) {
            // 完成
            this.splicing.push({ data: [...result] });
            result.splice(0);
            return process({
              code: "success",
              data: this.splicing,
              finish: true,
            });
          } else if (result[3] === WY_STATUS_MAP.extend.code) {
            // 拼接
            // log(result, "Part" + this.splicing.length);
            this.splicing.push({
              data: [...result],
              label: this.parseResponse(result.slice(6, -2)),
            });
            result.splice(0);
            process({ code: "success", data: this.splicing, finish: false });
          } else {
            // 错误码
            let msg = result[3];
            if (msg === WY_STATUS_MAP.overTime.code) return; //
            Object.keys(WY_STATUS_MAP).findIndex((n) => {
              if (result[3] === WY_STATUS_MAP[n]?.code)
                msg = WY_STATUS_MAP[n]?.msg;
            });
            this.scanStop();
            return error({ code: result[3], msg }); // 返回错误消息
          }
        }
      }
    } catch (e) {
      this.scanStop();
      return error({ code: "JS", msg: String(e) });
    }
  }

  // 串口关闭连接
  async disconnect() {
    try {
      if (!this.port) return;
      console.log("正在关闭串口...");

      // 1️⃣ 停止读取
      if (this.reader) {
        console.log("取消读取...");
        await this.reader.cancel().catch(() => {});
        this.reader.releaseLock();
        this.reader = null;
      }

      // 2️⃣ 停止写入
      if (this.writer) {
        console.log("关闭写入...");
        await this.writer.close().catch(() => {});
        this.writer.releaseLock();
        this.writer = null;
      }

      // 3️⃣ 确保流已释放
      if (this.port?.readable) {
        await this.port.readable.cancel();
      }

      if (this.port?.writable) {
        await this.port.writable.abort();
      }

      // 4️⃣ 最后关闭串口
      if (this.port) {
        await this.port.close();
        this.port = null;
        console.log("✅ 串口已成功关闭");
      }
    } catch (err) {
      console.error("关闭串口时出错：", err);
    }
  }

  // 扫描标签
  scanLabel(process, error, options = {}) {
    const opts = { ant: 0x80, scanTime: 50, ...options };
    const qValue = buildByteValue({
      bit7: 0,
      bit6: 0,
      bit5: 1,
      bit4: 0,
      bit3_0: 15,
    }); // QValue
    const session = 0xff; // 1个字节，询查EPC标签时使用的Session值。
    const maskMem = 0x01; // 一个字节，掩码区。0x01：EPC存储区；0x02：TID存储区；0x03：用户存储区。其他值保留。
    const maskAdr = [0x00, 0x00]; // 掩码相关
    const maskLen = 0x00; // 掩码相关
    const maskData = []; // 掩码相关
    const adrTID = 2; // 表示从 TID 存储区的哪个 字（Word） 开始读取
    const lenTID = 4; // 读取4个字
    const target = 0x00; // 询查EPC标签时使用的Target值
    const ant = opts.ant; // 本次要进行询查的天线号
    const scanTime = opts.scanTime; // 查询时间 10 * 100 ms
    this.sendCommand(
      0x00,
      0x01,
      [
        qValue,
        session,
        maskMem,
        ...maskAdr,
        maskLen,
        ...maskData,
        adrTID,
        lenTID,
        target,
        ant,
        scanTime,
      ],
      process,
      error,
      options,
    );
  }

  // 结束扫描
  scanStop() {
    this.scanning = false;
    this.splicing.splice(0);
    // console.log(this.splicing, "-------------------------stop");
  }

  // 格式化数据，去重
  formatLabel(labels) {
    if (!labels) return {};
    const result = {};
    labels.forEach((data) => {
      if (!data.label) return;
      data.label.forEach((label) => {
        if (label.rssi < 60) return;
        if (!!result[label.tid]) {
          result[label.tid].count = result[label.tid].count + 1;
        } else {
          result[label.tid] = { ...label, count: 1 };
        }
      });
    });
    return Object.keys(result).map((n) => result[n]);
  }

  // 返回参数解析
  parseResponse(data, result = []) {
    // 目前data结构 Len 1byte + N byte + RSSI 1byte
    const header = {
      FastID: (data[0] & 0x80) !== 0,
      HasPhaseFreq: (data[0] & 0x40) !== 0,
      N: data[0] & 0x3f,
    };
    result.push({
      tid: data.slice(1, 1 + header.N).join(""),
      rssi: Number("0x" + data[1 + header.N]),
    });
    const next = data.slice(2 + header.N);
    if (next.length > 0) this.parseResponse(next, result);
    return result;
  }

  // 获取port
  async getPort() {
    const ports = await navigator.serial.getPorts(); // 获取已授权的设备
    if (ports.length > 0) {
      // 若之前授权过
      const port = ports[0];
      console.log("✅ 自动连接成功");
      return port;
    } else {
      // 否则首次请求授权
      const port = await navigator.serial.requestPort();
      console.log("✅ 首次授权并连接成功");
      return port;
    }
  }

  // 构造命令帧
  // adr: 读写器地址, cmd: 命令码, data: Uint8Array 或 []。
  buildCommand(adr, cmd, data = []) {
    const dataArr = Array.from(data);
    const len = 4 + dataArr.length; // Len 不含自身
    const frame = [len, adr, cmd, ...dataArr];
    const crc = CRC16Modbus(Uint8Array.from(frame));
    frame.push(crc & 0xff); // LSB
    frame.push((crc >> 8) & 0xff); // MSB
    return new Uint8Array(frame);
  }
}
