import { WYuanW } from "./_brand/wyuan-w";

export default class Serial {
  instance = null;
  MODEL_MAP = { wyuan_w: { name: "wyuan_w", getInstance: () => new WYuanW() } };

  constructor(mode) {
    this.instance = MODEL_MAP[mode].getInstance();
  }

  async connect() {
    await this.instance.connect();
  }
}
