// 定义统一接口规范
export class RfidInterface {
  async connect() {
    throw new Error("connect() 未实现");
  }

  async sendCommand(cmd) {
    throw new Error("sendCommand() 未实现");
  }

  async readResponse() {
    throw new Error("readResponse() 未实现");
  }

  async disconnect() {
    throw new Error("disconnect() 未实现");
  }
}
