import { RfidInterface } from "../rfid-interface";

export class RfidImpinj extends RfidInterface {
  async connect() {
    console.log("🔌 串口连接已建立");
  }

  async sendCommand(cmd) {
    console.log(`📤 串口发送命令: ${cmd}`);
  }

  async readResponse() {
    console.log("📥 串口读取响应");
    return "Serial Response";
  }

  async disconnect() {
    console.log("❌ 串口连接关闭");
  }
}
