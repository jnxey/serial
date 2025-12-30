import { RfidWYuan } from "./models/rfid-w-yuan";
import { RfidHf } from "./models/rfid-hf";

export class RfidFactory {
  static HF_SUPPORT_PORTS = 8899;
  static MODE = {
    w_yuan: "w-yuan",
    hf: "hf",
  };

  static createInterface(type) {
    switch (type.toLowerCase()) {
      case RfidFactory.MODE.w_yuan:
        return new RfidWYuan();
      case RfidFactory.MODE.hf:
        return new RfidHf();
      default:
        throw new Error(`未知的RFID接口类型: ${type}`);
    }
  }
}
