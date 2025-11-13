import { RfidWYuan } from "./models/rfid-w-yuan";
import { RfidImpinj } from "./models/rfid-impinj";

export class RfidFactory {
  static createInterface(type) {
    switch (type.toLowerCase()) {
      case "w-yuan":
        return new RfidWYuan();
      case "impinj":
        return new RfidImpinj();
      default:
        throw new Error(`未知的RFID接口类型: ${type}`);
    }
  }
}
