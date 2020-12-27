import * as dgram from "dgram";

// currently I only use DRGB protocol for a single LED
enum WledUdpProtocol {
    WLEDNotifier = 0,
    WARLS,
    DRGB,
    DRGBW,
    DNRGB
};

export class WLEDControl {
    protected udp: dgram.Socket;

    constructor(protected host: string, protected port: number = 21324) {
        this.initUdp();
    }
    
    initUdp() {
        this.udp = dgram.createSocket('udp4');
        this.udp.connect(this.port, this.host);
        setTimeout(() => this.sendRGB(Buffer.from([0, 255, 0])), 500);
        setTimeout(() => this.sendRGB(Buffer.from([0, 0, 0])), 1000);
    }

    public async sendRGB(rgb: Buffer) {
        let buf = Buffer.alloc(5);
        buf.writeUInt8(WledUdpProtocol.DRGB, 0);
        buf.writeUInt8(15, 1); // LED timeout in s
        rgb.copy(buf, 2, 0, 3);
        await new Promise((resolve, reject) => this.udp.send(buf, resolve));
    }

}