export class SerialBase {
  // 实体
  port = null;
  writer = null;
  reader = null;

  // 日志输出
  log(msg) {
    console.log(`---------------${msg}-----------------`);
  }

  // byte数据转为16进制
  byteToHex(value) {
    return Array.from(value)
      .map((v) => v.toString(16).padStart(2, "0"))
      .join(" ");
  }

  // CRC尾码
  crc16(buffer) {
    let crc = 0xffff;
    for (let i = 0; i < buffer.length; i++) {
      crc ^= buffer[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 0x0001) crc = (crc >> 1) ^ 0x8408;
        else crc >>= 1;
      }
    }
    return crc & 0xffff;
  }

  // 构造命令帧
  // adr: 读写器地址, cmd: 命令码, data: Uint8Array 或 []。
  buildCommand(adr, cmd, data = []) {
    const dataArr = Array.from(data);
    const len = 4 + dataArr.length; // Len 不含自身
    const frame = [len, adr, cmd, ...dataArr];
    const crc = this.crc16(Uint8Array.from(frame));
    frame.push(crc & 0xff); // LSB
    frame.push((crc >> 8) & 0xff); // MSB
    return new Uint8Array(frame);
  }

  // 连接设备
  async connect(config) {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: config.baudRate });
    const writer = port.writable.getWriter();
    const reader = port.readable.getReader();
    this.port = port;
    this.writer = writer;
    this.reader = reader;
    this.log("串口已连接");
  }

  // 发送命令
  // adr: 读写器地址, cmd: 命令码, data: Uint8Array 或 []。callback: 回调函数
  async send(adr, cmd, data = [], success, error) {
    try {
      if (!this.writer) return log("请先连接串口");

      // 举例：地址0x00，命令0x10，Data=[0x01, 0x02]
      const cmdByte = this.buildCommand(adr, cmd, data);
      await this.writer.write(cmdByte);
      this.log("发送: " + this.byteToHex(cmdByte));

      // 等待结果返回
      const result = [];
      let fullLen = null;
      while (this.port.readable) {
        const { value, done } = await this.reader.read();
        if (done) return error();
        if (!result.length) fullLen = value.toString(16) + 1; // +1是因为要包含Len自身
        if (value) {
          result.push(value.toString(16).padStart(2, "0"));
          this.log("收到: " + this.byteToHex(value));
          if (result.length === fullLen) {
            this.reader.releaseLock();
            return success(result);
          }
        }
      }
    } catch (e) {
      error();
    }
  }
}
