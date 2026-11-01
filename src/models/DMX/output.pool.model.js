/** Simulation-only output pool: no transport dependency can be instantiated. */
export default class OutputPool {
  constructor() { this.outputs = []; this.selected = []; }
  get showData() { return []; }
  get listable() { return []; }
  addRaw() { throw new Error('教学模拟禁止设备输出 / Hardware output disabled'); }
  getFromId() { throw new Error('教学模拟无硬件输出 / No hardware outputs'); }
  clearAll() { this.outputs = []; }
  delete() {}
}
