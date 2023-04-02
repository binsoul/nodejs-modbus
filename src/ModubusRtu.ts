const modbusErrorMessages = ['Unknown error', 'Illegal function', 'Illegal data address', 'Illegal data value', 'Slave device failure', 'Acknowledge', 'Slave device busy', 'Memory Parity Error'];

/**
 * Implements the Modbus RTU protocol.
 */
export class ModbusRtu {
    private readonly unitAddress;

    /**
     *
     * @param {number} unitAddress Address of the target unit
     */
    constructor(unitAddress: number) {
        this.unitAddress = unitAddress;
    }

    /**
     * Modbus function 0x03 request
     *
     * Requests a read of one or more (up to 125 at a time) holding registers or 4xxxxx type analog addresses.
     */
    public requestHoldingRegisters(firstRegister: number, lastRegister: number): Buffer {
        const codeLength = 6;
        const length = lastRegister - firstRegister + 1;

        const buffer = Buffer.alloc(codeLength + 2);
        buffer.writeUInt8(this.unitAddress, 0);
        buffer.writeUInt8(0x03, 1);
        buffer.writeUInt16BE(firstRegister, 2);
        buffer.writeUInt16BE(length, 4);
        buffer.writeUInt16LE(this.crc16(buffer.subarray(0, -2)), codeLength);

        return buffer;
    }

    /**
     * Modbus function 0x03 response
     *
     * Returns the values of holding registers or 4xxxxx type analog addresses.
     */
    public fetchHoldingRegisters(response: Buffer): Array<number> {
        this.validateResponse(0x03, response);

        const length = response.readUInt8(2);
        const contents = [];

        for (let i = 0; i < length; i += 2) {
            const reg = response.readUInt16BE(i + 3);
            contents.push(reg);
        }

        return contents;
    }

    private validateResponse(functionCode: number, response: Buffer): void {
        const crc = response.readUInt16LE(response.length - 2);
        if (crc !== this.crc16(response.subarray(0, -2))) {
            throw new Error('The CRC of the response is invalid.');
        }

        if (this.unitAddress !== response.readUInt8(0)) {
            throw new Error(`Expected unit address ${this.unitAddress} but received ${response.readUInt8(0)}.`);
        }

        const code = response.readUInt8(1);

        if (response.length >= 5 && code === (0x80 | functionCode)) {
            const errorCode = response.readUInt8(2);

            throw new Error(`Modbus exception ${errorCode}: ` + (modbusErrorMessages[errorCode] || 'Unknown error'));
        }

        if (code !== functionCode) {
            throw new Error(`Expected function 0x${functionCode.toString(16)} but received 0x${response.readUInt8(1).toString(16)}.`);
        }
    }

    private crc16(buffer: Buffer): number {
        let crc = 0xffff;
        let odd;

        for (let i = 0; i < buffer.length; i++) {
            crc = crc ^ buffer[i];

            for (let j = 0; j < 8; j++) {
                odd = crc & 0x0001;
                crc = crc >> 1;
                if (odd) {
                    crc = crc ^ 0xa001;
                }
            }
        }

        return crc;
    }
}
