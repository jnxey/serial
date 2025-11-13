// 日志输出
export function log(msg) {
  console.log(`---------------${msg}-----------------`);
}

// byte数据转为16进制
export function byteToHex(value) {
  return Array.from(value)
    .map((v) => v.toString(16).padStart(2, "0"))
    .join(" ");
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
