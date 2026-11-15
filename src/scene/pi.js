// My Raspberry Pi 3B+ (the Kismet sensor that sends deauth alerts to Wazuh), bare board, my own geometry after its real layout. In metres:
// the board lies flat, its centre at the origin, its USB and Ethernet end to +x. Its power LED glows; the green activity LED blinks (rack.js)
import * as THREE from 'three';

export function buildPi() {
  const mat = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const pcb = mat('#1f6b3c', .6), steel = mat('#c9ccd1', .3, 1), black = mat('#151515', .6), chip = mat('#3a3a3a', .4, .2);
  const grp = new THREE.Group(), L = .085, Wd = .056, T = .0016;
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); grp.add(o); return o; };
  box(L, T, Wd, pcb, 0, T / 2, 0);
  box(.017, .015, .0133, steel, L / 2 - .0085 + .002, T + .0075, -.0175);   // USB pair, USB pair, Ethernet: the end that overhangs the board
  box(.017, .015, .0133, steel, L / 2 - .0085 + .002, T + .0075, .0005);
  const eth = box(.021, .0135, .016, steel, L / 2 - .0105 + .002, T + .00675, .019);
  box(.051, .0085, .005, black, -.0075, T + .00425, -Wd / 2 + .0035);       // the 40-pin GPIO header along the far edge
  box(.014, .0012, .014, chip, -.008, T + .0006, .002);                      // the SoC
  box(.009, .001, .009, chip, .012, T + .0005, -.004);                       // the USB / LAN chip
  const led = (c, x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(.0025, .001, .0015), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); m.position.set(x, T + .0005, Wd / 2 - .003); grp.add(m); return m; };
  led('#ff2020', -L / 2 + .004);                                             // power
  const act = led('#20ff40', -L / 2 + .008);                                 // activity
  return { grp, act, port: new THREE.Vector3(eth.position.x + .0105, T + .006, eth.position.z) };   // port: the Ethernet socket's mouth
}
