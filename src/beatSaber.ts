import * as WebSocket from 'ws';

export enum BeatMapEventType {
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

export enum LightValue {
    Off = 0,
    BlueOn,
    BlueFlash,
    BlueFade,
    RedOn = 5,
    RedFlash,
    RedFade
}

export interface BeatMapEvent {
    type: BeatMapEventType;
    value: LightValue;
}

export class BeatSaberConnection {
    private colorFadeTime = 500;
    private colorFlashTime = 200;
    private updateRate = 120; // updates / s

    private ws: WebSocket;
    private colorCallback: Function;
    private blockEventCallback: Function;

    constructor(protected websocketUrl: string) {
        this.wsConnect();
        // setTimeout(() => this.setLightValue(LightValue.BlueOn), 2000);
        // setTimeout(() => this.setLightValue(LightValue.RedFade), 3000);
        // setTimeout(() => this.setLightValue(LightValue.BlueFlash), 4000);
    }

    public setColorCallback(colorCallback: (rgb: Buffer) => void) {
        this.colorCallback = colorCallback;
    }
    
    private lightStates: LightValue[] = [0, 0, 0, 0, 0];
    private lightNames: String[] = [
        "BackLz",
        "RingLg",
        "LeftLz",
        "RghtLz",
        "RoadLg",
    ];
    private valueNames: String[] = [
        "Off      ",
        "Blue     ",
        "BlueFlash",
        "BlueFade ",
        "",
        "Red      ",
        "RedFlash ",
        "RedFade  "
    ];
    
    private async printBeatmapEvent(ev: BeatMapEvent) {
        if(ev.type >= BeatMapEventType.BackLasers && ev.type <= BeatMapEventType.RoadLights) {
            this.lightStates[ev.type] = ev.value;
            let str = "";
            for(let i = 0; i < 5; i++) {
                str += this.lightNames[i] + ": ";
                if(ev.type == i) {
                    str += this.valueNames[this.beatmapLightStates[i]];
                }
                else {
                    str += "         ";
                }
                str += "   ";
            }
            console.log(str);
            
            // let typeStr = BeatMapEventType[ev.type];
            // let valueStr = LightValue[ev.value];
            // console.log(typeStr, valueStr);
            
            // console.log(valueNames[ev.value]);
        }
    }

    private setColor(color: Array<number>) {
        if(this.colorCallback) {
            this.colorCallback(Buffer.from(color));
        }
    }
    
    
    private beatmapLightStates: LightValue[] = [0, 0, 0, 0, 0];
    private setLightTimeout: NodeJS.Timeout;
    private lightStateOffTimeout: NodeJS.Timeout[] = [undefined, undefined, undefined, undefined, undefined];
    private fadeColor: number[] = [0, 0, 0];
    private fadeIterator: number = 0;
    // private fadeStart: number;

    // fades up a color quickly and stays on
    private doFlash() {
        let timeStep = 1000 / this.updateRate;
        
        // scale color with time
        let progress = this.fadeIterator * timeStep / this.colorFlashTime;
        if(progress > 1) {
            progress = 1;
        }
        let result = this.fadeColor.map(c => Math.floor(c * progress));
        this.setColor(result);
        
        if(this.fadeIterator * timeStep < this.colorFlashTime) {
            setTimeout(() => this.doFlash(), timeStep);
        }
        this.fadeIterator++;
    }
    
    // sets a color and fades down from there
    private doFade() {
        let timeStep = 1000 / this.updateRate;
        
        // scale color with time
        let progress = this.fadeIterator * timeStep / this.colorFadeTime;
        if(progress > 1) {
            progress = 1;
        }
        let result = this.fadeColor.map(c => Math.floor(c * (1 - progress)));
        this.setColor(result);
    
        if(this.fadeIterator * timeStep < this.colorFadeTime) {
            setTimeout(() => this.doFade(), timeStep);
        }
        this.fadeIterator++;
    }

    private startFadeAction(color: number[], timeoutFunc: Function) {
        this.fadeColor = color;
        this.fadeIterator = 0;
        timeoutFunc();
    }

    private async setLightValue(lv: LightValue, lightType: BeatMapEventType = undefined) {
        clearTimeout(this.setLightTimeout);
        clearTimeout(this.lightStateOffTimeout[lightType]);
        switch(lv) {
            case LightValue.Off: 
                this.setColor([0, 0, 0]);
                break;
            case LightValue.BlueOn:
                this.setColor([0, 0, 255]);
                break;
            case LightValue.RedOn:
                this.setColor([255, 0, 0]);
                break;
            case LightValue.BlueFlash:
                this.startFadeAction([0, 0, 255], () => this.doFlash());
                break;
            case LightValue.RedFlash:
                this.startFadeAction([255, 0, 0], () => this.doFlash());
                break;
            case LightValue.BlueFade:
                this.startFadeAction([0, 0, 255], () => this.doFade());
                break;
            case LightValue.RedFade:
                this.startFadeAction([255, 0, 0], () => this.doFade());
                break;
        }

        // mark lights as off when they are faded to black
        if(lightType !== undefined && (lv == LightValue.BlueFade || lv == LightValue.RedFade)) {
            this.lightStateOffTimeout[lightType] = setTimeout(() => {this.beatmapLightStates[lightType] = LightValue.Off;}, this.colorFadeTime);
        }
    }
    
    private async handleBeatmapEvent(ev: BeatMapEvent) {
        if(ev.type >= BeatMapEventType.BackLasers && ev.type <= BeatMapEventType.RoadLights) {

            // filter out duplicate off commands
            if(ev.value == LightValue.Off && this.beatmapLightStates[ev.type] == LightValue.Off) {
                return;
            }

            this.beatmapLightStates[ev.type] = ev.value;
            let lightValue: LightValue = undefined;

            // aliases for easier reading
            let roadLights = this.beatmapLightStates[BeatMapEventType.RoadLights];
            let ringLights = this.beatmapLightStates[BeatMapEventType.RingLights];
            let off = LightValue.Off;


            // follow road and ring light events by default (check if type is road/ring light)
            if([BeatMapEventType.RoadLights, BeatMapEventType.RingLights].includes(ev.type)) {
                // if one of the main light turns off, switch color to other main light
                if(ev.value == off && ringLights != off) {
                    lightValue = ringLights;
                }
                else if(ev.value == off && roadLights != off) {
                    lightValue = roadLights;
                }
                else {
                    lightValue = ev.value;
                }
            }
            // when both road and ring lights are off, follow laser light events
            else if(roadLights == off && ringLights == off) {
                lightValue = ev.value;
            }

            // overwrite filter and just display every light event from all sources
            // TODO: write better filter
            lightValue = ev.value; 

            this.setLightValue(lightValue, ev.type);
        }
    }

    private async handleBSEvent(event: any) {
        // console.log(event);
        try {
            let data = JSON.parse(event);
            // console.log(data);
            switch(data.event) {
                case 'beatmapEvent': {
                    let ev: BeatMapEvent = data.beatmapEvent;
                    this.printBeatmapEvent(ev);
                    this.handleBeatmapEvent(ev);
                    break;
                }
                case 'noteMissed':
                case 'noteCut': {
                    // // rudimentary color by note block (doesn't look as good)
                    // let nc = data.noteCut;
                    // console.log({noteType: nc.noteType, timeNextNote: nc.timeToNextBasicNote});
                    // this.colorFadeTime = Math.floor(nc.timeToNextBasicNote * 1000); 
                    // if(nc.noteType == 'NoteA') {
                    //     this.setLightValue(LightValue.RedFade);
                    // }
                    // else {
                    //     this.setLightValue(LightValue.BlueFade);
                    // }
                    break;
                }
                case 'songStart': {
                    break;
                }
                case 'finished': 
                case 'failed': {
                    break;
                }
                case 'pause': {
                    break;
                }
                case 'resume': {
                    break;
                }
                default:
                    // console.log(data);
                    break;
            }
        }
        catch(e) {
            console.log(e);
        }
    }

    private async wsConnect(): Promise<Boolean> {
        try {
            this.ws = new WebSocket(this.websocketUrl);
            this.ws.onopen = () => {
                console.log("Connection established");
            };
            this.ws.onclose = () => {
                console.log("Connection closed. Trying to reconnect in 15s...");
                setTimeout(() => this.wsConnect(), 15000);
            };
            this.ws.onmessage = (data) => this.handleBSEvent(data.data);
            this.ws.onerror = () => {
                console.log("Error opening connection to beatsaber-http-status.");
            };
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
    }
}