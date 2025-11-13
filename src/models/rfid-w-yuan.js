import { RfidInterface } from "../rfid-interface";
import { byteToHex, CRC16Modbus, log } from "../tools";

export class RfidWYuan extends RfidInterface {
  // 实例
  baudRate = 57600;
  port = null;
  writer = null;
  reader = null;

  // 连接设备
  async connect() {
    const port = await this.getPort();
    await port.open({ baudRate: this.baudRate });
    const writer = port.writable.getWriter();
    const reader = port.readable.getReader();
    this.port = port;
    this.writer = writer;
    this.reader = reader;
    log("串口已连接");
  }

  // 发送命令
  async sendCommand(adr, cmd, data = [], success, error) {
    try {
      if (!this.writer) return log("请先连接串口");
      // 举例：地址0x00，命令0x10，Data=[0x01, 0x02]
      const cmdByte = this.buildCommand(adr, cmd, data);
      await this.writer.write(cmdByte);
      log("发送: " + byteToHex(cmdByte));
      const result = await this.readResponse();
      success(result);
    } catch (e) {
      log(e);
      error();
    }
  }

  // 读取结果
  async readResponse() {
    // 等待结果返回
    const result = [];
    let fullLen = null;
    while (this.port.readable) {
      const { value, done } = await this.reader.read();
      if (done && !!value) break;
      if (!result.length) fullLen = Number(value.toString(16)) + 1; // +1是因为要包含Len自身
      result.push(byteToHex(value));
      log("收到: " + byteToHex(value));
      if (result.length === fullLen) {
        this.reader.releaseLock();
        log("接收结束");
        break;
      }
    }
    return result;
  }

  // 串口关闭连接
  async disconnect() {
    try {
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
      if (this.port.readable) {
        try {
          await this.port.readable.cancel();
        } catch {}
      }
      if (this.port.writable) {
        try {
          await this.port.writable.abort();
        } catch {}
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
