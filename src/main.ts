import * as WebSocket from 'ws';
const wsUrl = 'ws://localhost:6557/socket';


let ws;

enum BeatMapEventType {
    BackLasers = 0,
    RingLights,
    LeftLasers,
    RightLasers,
    RoadLights,
    CustomLight1,
    CustomLight2,
    CustomLight3,
    RingsRotate,
    RingsZoom,
    CustomLight4,
    CustomLight5,
    LeftLasersSpeed,
    RightLasersSpeed,
    EarlyRotation,
    LateRotation
}

enum LightValue {
    Off = 0,
    BlueOn,
    BlueFlash,
    BlueFade,
    RedOn = 5,
    RedFlash,
    RedFade
}

interface BeatMapEvent {
    type: BeatMapEventType;
    value: LightValue;
}

let lightStates: LightValue[] = [0, 0, 0, 0, 0];
let lightNames: String[] = [
    "BackLz",
    "RingLg",
    "LeftLz",
    "RghtLz",
    "RoadLg",
];
let valueNames: String[] = [
    "Off      ",
    "Blue     ",
    "BlueFlash",
    "BlueFade ",
    "",
    "Red      ",
    "RedFlash ",
    "RedFade  "
];

async function handleBSEvent(event: any) {
    // console.log(event);
    try {
        let data = JSON.parse(event);
        if(data.event == 'beatmapEvent') {
            let ev: BeatMapEvent = data.beatmapEvent;
            if(ev.type >= BeatMapEventType.BackLasers && ev.type <= BeatMapEventType.RoadLights) {
                lightStates[ev.type] = ev.value;
                let str = "";
                // TODO: print only what changed
                for(let i = 0; i < 5; i++) {
                    str += lightNames[i] + ": ";
                    str += valueNames[lightStates[i]];
                    str += "   ";
                }
                console.log(str);
                // let typeStr = BeatMapEventType[ev.type];
                // let valueStr = LightValue[ev.value];
                // console.log(typeStr, valueStr);
            }
            else {
                // console.log(ev);
            }
        }
    }
    catch(e) {
        
    }
}

async function wsConnect(): Promise<Boolean> {
    try {
        ws = new WebSocket(wsUrl);
        ws.on('open', () => {
            console.log("Connection established");
        });
        ws.on('close', () => {
            console.log("Connection closed. Trying to reconnect in 15s...");
            setTimeout(wsConnect, 15000);
        });
        ws.on('message', (data) => handleBSEvent(data));
        ws.on('error', () => {
            console.log("Error opening connection to beatsaber-http-status.");
        })
        return true;
    }
    catch(e) {
        console.log(e.code);
        if(e.code == 'ECONNREFUSED') {
            return false;
        }
        console.trace(e);
        return false;
    }
};


wsConnect();