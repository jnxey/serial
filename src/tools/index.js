// 日志输出
export function log(msg) {
  console.log(`---------------${msg}-----------------`);
}

// byte数据转为16进制
export function byteToHex(value) {
  return Array.from(value).map((v) => v.toString(16).padStart(2, "0"));
}

// CRC尾码
export function CRC16Modbus(buffer) {
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

// 构建 8位二进制标志位组合成的 1 个字节
export function buildByteValue({
  bit7 = 0, // bit7
  bit6 = 0, // bit6
  bit5 = 0, // bit5
  bit4 = 0, // bit4
  bit3_0 = 0, // bit3~0
} = {}) {
  if (bit3_0 < 0 || bit3_0 > 15) throw new Error("Q值必须在0~15之间");
  return (
    (bit7 << 7) | (bit6 << 6) | (bit5 << 5) | (bit4 << 4) | (bit3_0 & 0x0f)
  );
}
