/** Simulation-only output pool: no transport dependency can be instantiated. */
export default class OutputPool {
  constructor() { this.outputs = []; this.selected = []; }
  get showData() { return []; }
  get listable() { return []; }
  addRaw() { throw new Error('此项目未连接现场设备 / Hardware output disabled'); }
  getFromId() { throw new Error('没有可用的设备输出 / No hardware outputs'); }
  clearAll() { this.outputs = []; }
  delete() {}
}
