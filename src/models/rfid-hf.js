import { RfidInterface } from "../rfid-interface";
import {
  byteToHex,
  CRC16Modbus,
  delayExec,
  getJSON,
  getParams,
  log,
} from "../tools";

const HF_SUPPORT_PORTS = 8899;
const READ_LABEL_LENGTH = 19;

export class RfidHf extends RfidInterface {
  static scanning = false;
  deviceIP = null;
  splicing = []; // 行进中的
  wsServer = null;
  wsListener = null;

  async connect(success, error, options = {}) {
    try {
      // 初始化网络服务
      this.wsServer = new WebSocket(`ws://${options.ip}`);
      this.wsServer.onmessage = async (e) => {
        const info = getJSON(e.data, {});
        if (info.type === "data") {
          // 接收数据
          if (!!this.wsListener) this.wsListener(info.data);
        } else if (info.type === "ports") {
          // 拿到已连接的设备，并连接
          const ports = info.data?.map((val) => ({
            value: val.ip + "_" + val.port,
            name: val.ip + "_" + val.port,
          }));
          if (!ports.length) return error({ msg: "Not Found Devices" });
          let cKey = ports.findIndex(
            (val) => val.value === options.cache_device,
          );
          if (!!ports[cKey]) {
            // 连接设备
            this.wsServer.send(
              getParams({ action: "open", rIP: ports[cKey].value }),
            );
          } else if (!!options.select_port) {
            const rIP = await options.select_port(ports);
            this.wsServer.send(getParams({ action: "open", rIP: rIP }));
          }
        } else if (info.type === "open-success") {
          // 已打开串口
          success();
        } else if (info.type === "error") {
          // 已打开串口
          error(info.msg);
        }
      };
      this.wsServer.onopen = () => {
        if (!!this.deviceIP) {
          this.wsServer.send(getParams({ action: "open", rIP: this.deviceIP }));
        } else {
          // 先获取设备
          this.wsServer.send(
            getParams({ action: "ports", port: HF_SUPPORT_PORTS }),
          );
        }
      };
    } catch (e) {
      error(e);
    }
  }

  async sendCommand(cmd, process, error, options) {
    try {
      if (!this.wsServer)
        return error({ msg: "Please connect the device first." });
      this.scanning = true;
      while (this.scanning) {
        this.clearSplicing();
        this.wsServer.send(getParams({ action: "send", data: cmd }));
        log(byteToHex(cmd), "发送");
        await this.readResponse(process, error);
        await delayExec(300);
      }
    } catch (e) {
      log(e);
      error({ code: "JS", msg: String(e) });
      this.scanStop();
    }
  }

  // 读取结果
  readResponse(process, error) {
    try {
      return new Promise((resolve) => {
        // 等待结果返回
        this.wsListener = (buffer) => {
          if (!this.scanning) return resolve();
          const result = buffer?.data ?? [];
          const format = byteToHex(result);
          if (result.length === READ_LABEL_LENGTH) {
            const tidArr = format.slice(10, -2);
            // console.log(tidArr.join("").toUpperCase(), "-----------tid");
            // 读取到标签操作
            this.splicing.push({
              data: [...format],
              label: [
                {
                  tid: tidArr.join("").toUpperCase(),
                  rssi: Number(result[6]),
                  antenna: Number(result[4]),
                },
              ],
            });
            process({ code: "success", data: this.splicing, finish: false });
          } else {
            // 完成此次操作
            return resolve(
              process({ code: "success", data: this.splicing, finish: true }),
            );
          }
        };
      });
    } catch (e) {
      this.scanStop();
      return Promise.resolve(error({ code: "JS", msg: String(e) }));
    }
  }

  async disconnect() {
    console.log("❌ 串口连接关闭");
    if (!this.wsServer) return;
    this.wsServer.close();
  }

  // 扫描标签
  scanLabel(process, error, options = {}) {
    const opts = { ant: 0xff, scanTime: 50, ...options };
    const cmd = [0xdd, 0x11, 0xef, "len", opts.ant, 0x01, 0x01];
    cmd[3] = cmd.length + 2;
    const crc = CRC16Modbus(Uint8Array.from(cmd));
    cmd.push(crc & 0xff); // LSB
    cmd.push((crc >> 8) & 0xff); // MSB
    this.sendCommand(cmd, process, error, options);
  }

  // 结束扫描
  scanStop() {
    this.scanning = false;
    this.wsListener = null;
    this.clearSplicing();
  }

  // 清空卡片列表
  clearSplicing() {
    this.splicing.splice(0);
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
}
