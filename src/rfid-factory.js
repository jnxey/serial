import { RfidWYuan } from "./models/rfid-w-yuan";
import { RfidImpinj } from "./models/rfid-impinj";

export class RfidFactory {
  static MODE = {
    w_yuan: "w-yuan",
    impinj: "impinj",
  };

  static createInterface(type) {
    switch (type.toLowerCase()) {
      case RfidFactory.MODE.w_yuan:
        return new RfidWYuan();
      case RfidFactory.MODE.impinj:
        return new RfidImpinj();
      default:
        throw new Error(`未知的RFID接口类型: ${type}`);
    }
  }
}
