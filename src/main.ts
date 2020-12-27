import { BeatSaberConnection } from './beatSaber';
import { WLEDControl } from './wled';
const wsUrl = 'ws://localhost:6557/socket';
const wledHost = 'leo_bett_led.lan'

let bs = new BeatSaberConnection(wsUrl);
let wled = new WLEDControl(wledHost);

bs.setColorCallback((rgb) => wled.sendRGB(rgb));