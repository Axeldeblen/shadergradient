import * as THREE from 'three';
import {
        DataTextureLoader,
        DataUtils,
        FloatType,
        HalfFloatType,
        LinearFilter,
        LinearSRGBColorSpace,
        LoadingManager // Added for constructor
} from 'three';

// Interface for Uint8Array with an added pos property
interface Uint8ArrayWithPos extends Uint8Array {
    pos: number;
}

/**
 * A loader for the RGBE HDR texture format.
 *
 * ```js
 * const loader = new RGBELoader();
 * const envMap = await loader.loadAsync( 'textures/equirectangular/blouberg_sunrise_2_1k.hdr' );
 * envMap.mapping = THREE.EquirectangularReflectionMapping;
 *
 * scene.environment = envMap;
 * ```
 *
 * @augments DataTextureLoader
 * @three_import import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
 */
class RGBELoader extends DataTextureLoader {
        public type: typeof FloatType | typeof HalfFloatType; // Explicitly declare type

        /**
         * Constructs a new RGBE loader.
         *
         * @param {LoadingManager} [manager] - The loading manager.
         */
        constructor( manager?: LoadingManager ) { // Typed manager, made optional

                super( manager );

                /**
                 * The texture type.
                 *
                 * @type {(HalfFloatType|FloatType)}
                 * @default HalfFloatType
                 */
                this.type = HalfFloatType;

        }

        /**
         * Parses the given RGBE texture data.
         *
         * @param {ArrayBuffer} buffer - The raw texture data.
         * @return {DataTextureLoader~TexData} An object representing the parsed texture data.
         */
        parse( buffer: ArrayBuffer ) { // Typed buffer

                // adapted from http://www.graphics.cornell.edu/~bjw/rgbe.html

                const
                        /* default error routine.  change this to change error handling */
                        rgbe_read_error = 1,
                        rgbe_write_error = 2,
                        rgbe_format_error = 3,
                        rgbe_memory_error = 4,
                        rgbe_error = function ( rgbe_error_code: number, msg?: string ) { // Typed params

                                switch ( rgbe_error_code ) {

                                        case rgbe_read_error: throw new Error( 'THREE.RGBELoader: Read Error: ' + ( msg || '' ) );
                                        case rgbe_write_error: throw new Error( 'THREE.RGBELoader: Write Error: ' + ( msg || '' ) );
                                        case rgbe_format_error: throw new Error( 'THREE.RGBELoader: Bad File Format: ' + ( msg || '' ) );
                                        default:
                                        case rgbe_memory_error: throw new Error( 'THREE.RGBELoader: Memory Error: ' + ( msg || '' ) );

                                }

                        },

                        /* offsets to red, green, and blue components in a data (float) pixel */
                        //RGBE_DATA_RED = 0,
                        //RGBE_DATA_GREEN = 1,
                        //RGBE_DATA_BLUE = 2,

                        /* number of floats per pixel, use 4 since stored in rgba image format */
                        //RGBE_DATA_SIZE = 4,

                        /* flags indicating which fields in an rgbe_header_info are valid */
                        RGBE_VALID_PROGRAMTYPE = 1,
                        RGBE_VALID_FORMAT = 2,
                        RGBE_VALID_DIMENSIONS = 4,

                        NEWLINE = '\n',

                        fgets = function ( buffer: Uint8ArrayWithPos, lineLimit?: number, consume?: boolean ) : string | false { // Typed params and return

                                const chunkSize = 128;

                                lineLimit = ! lineLimit ? 1024 : lineLimit;
                                let p = buffer.pos,
                                        i = - 1, len = 0, s = '',
                                        chunk = '';
                                try {
                                    // Spread Uint16Array into individual arguments for fromCharCode
                                    chunk = String.fromCharCode(...new Uint16Array(buffer.buffer.slice(p, p + chunkSize)));
                                } catch (e) {
                                    // console.error("Error creating chunk from buffer view:", e, p, chunkSize, buffer.byteLength);
                                    return false; // Or handle error appropriately
                                }


                                while ( ( 0 > ( i = chunk.indexOf( NEWLINE ) ) ) && ( len < lineLimit ) && ( p < buffer.byteLength ) ) {

                                        s += chunk; len += chunk.length;
                                        p += chunkSize;
                                        try {
                                            chunk += String.fromCharCode(...new Uint16Array(buffer.buffer.slice(p, p + chunkSize)));
                                        } catch (e) {
                                            // console.error("Error creating chunk from buffer view (loop):", e, p, chunkSize, buffer.byteLength);
                                            break;
                                        }
                                }

                                if ( - 1 < i ) {
                                        if ( false !== consume ) buffer.pos += len + i + 1;
                                        return s + chunk.slice( 0, i );
                                }
                                return false;
                        },

                        /* minimal header reading.  modify if you want to parse more information */
                        RGBE_ReadHeader = function ( buffer: Uint8ArrayWithPos ) { // Typed buffer


                                // regexes to parse header info fields
                                const magic_token_re = /^#\?(\S+)/,
                                        gamma_re = /^\s*GAMMA\s*=\s*(\d+(\.\d+)?)\s*$/,
                                        exposure_re = /^\s*EXPOSURE\s*=\s*(\d+(\.\d+)?)\s*$/,
                                        format_re = /^\s*FORMAT=(\S+)\s*$/,
                                        dimensions_re = /^\s*\-Y\s+(\d+)\s+\+X\s+(\d+)\s*$/,

                                        // RGBE format header struct
                                        header = {
                                                valid: 0,
                                                string: '',
                                                comments: '',
                                                programtype: 'RGBE',
                                                format: '',
                                                gamma: 1.0,
                                                exposure: 1.0,
                                                width: 0, height: 0
                                        };

                                let line: string | false;
                                let match; // Declare match here

                                line = fgets(buffer, undefined, true);
                                if (line === false) {
                                    rgbe_error(rgbe_read_error, 'no header found');
                                    throw new Error("fgets returned false"); // Should not happen due to rgbe_error
                                }
                                header.string += line + '\n'; // Add first line to header string

                                match = line.match(magic_token_re);
                                if (!match) {
                                    rgbe_error(rgbe_format_error, 'bad initial token');
                                    throw new Error("Bad initial token"); // Should not happen
                                }
                                header.valid |= RGBE_VALID_PROGRAMTYPE;
                                header.programtype = match[1];
                                // Removed header.string += line + '\n'; from here as it's added above

                                while ( true ) {
                                        line = fgets( buffer, undefined, true );
                                        if ( line === false ) break; // Check for false before using line
                                        header.string += line + '\n'; // Now line is confirmed string here

                                        if ( '#' === line.charAt( 0 ) ) { // No need for typeof check, already string
                                                header.comments += line + '\n';
                                                continue; // comment line
                                        }

                                        if ( typeof line === 'string' && (match = line.match( gamma_re )) ) {
                                                header.gamma = parseFloat( match[ 1 ] );
                                        }

                                        if ( typeof line === 'string' && (match = line.match( exposure_re )) ) {
                                                header.exposure = parseFloat( match[ 1 ] );
                                        }

                                        if ( typeof line === 'string' && (match = line.match( format_re )) ) {
                                                header.valid |= RGBE_VALID_FORMAT;
                                                header.format = match[ 1 ];//'32-bit_rle_rgbe';
                                        }

                                        if ( typeof line === 'string' && (match = line.match( dimensions_re )) ) {
                                                header.valid |= RGBE_VALID_DIMENSIONS;
                                                header.height = parseInt( match[ 1 ], 10 );
                                                header.width = parseInt( match[ 2 ], 10 );
                                        }

                                        if ( ( header.valid & RGBE_VALID_FORMAT ) && ( header.valid & RGBE_VALID_DIMENSIONS ) ) break;
                                }

                                if ( ! ( header.valid & RGBE_VALID_FORMAT ) ) {
                                        rgbe_error( rgbe_format_error, 'missing format specifier' );
                                }

                                if ( ! ( header.valid & RGBE_VALID_DIMENSIONS ) ) {
                                        rgbe_error( rgbe_format_error, 'missing image size specifier' );
                                }
                                return header;
                        },

                        RGBE_ReadPixels_RLE = function ( buffer: Uint8Array, w: number, h: number ) { // Typed params

                                const scanline_width = w;

                                if (
                                        ( ( scanline_width < 8 ) || ( scanline_width > 0x7fff ) ) ||
                                        ( ( 2 !== buffer[ 0 ] ) || ( 2 !== buffer[ 1 ] ) || ( buffer[ 2 ] & 0x80 ) )
                                ) {
                                        return new Uint8Array( buffer );
                                }

                                if ( scanline_width !== ( ( buffer[ 2 ] << 8 ) | buffer[ 3 ] ) ) {
                                        rgbe_error( rgbe_format_error, 'wrong scanline width' );
                                }

                                const data_rgba = new Uint8Array( 4 * w * h );
                                if ( ! data_rgba.length ) {
                                        rgbe_error( rgbe_memory_error, 'unable to allocate buffer space' );
                                }

                                let offset = 0, pos = 0;
                                const ptr_end = 4 * scanline_width;
                                const rgbeStart = new Uint8Array( 4 );
                                const scanline_buffer = new Uint8Array( ptr_end );
                                let num_scanlines = h;

                                while ( ( num_scanlines > 0 ) && ( pos < buffer.byteLength ) ) {
                                        if ( pos + 4 > buffer.byteLength ) {
                                                rgbe_error( rgbe_read_error, "Buffer too short for rgbeStart" );
                                        }

                                        rgbeStart[ 0 ] = buffer[ pos ++ ];
                                        rgbeStart[ 1 ] = buffer[ pos ++ ];
                                        rgbeStart[ 2 ] = buffer[ pos ++ ];
                                        rgbeStart[ 3 ] = buffer[ pos ++ ];

                                        if ( ( 2 != rgbeStart[ 0 ] ) || ( 2 != rgbeStart[ 1 ] ) || ( ( ( rgbeStart[ 2 ] << 8 ) | rgbeStart[ 3 ] ) != scanline_width ) ) {
                                                rgbe_error( rgbe_format_error, 'bad rgbe scanline format' );
                                        }

                                        let ptr = 0, count;
                                        while ( ( ptr < ptr_end ) && ( pos < buffer.byteLength ) ) {
                                                count = buffer[ pos ++ ];
                                                const isEncodedRun = count > 128;
                                                if ( isEncodedRun ) count -= 128;

                                                if ( ( 0 === count ) || ( ptr + count > ptr_end ) ) {
                                                        rgbe_error( rgbe_format_error, 'bad scanline data' );
                                                }

                                                if ( isEncodedRun ) {
                                                        const byteValue = buffer[ pos ++ ];
                                                        for ( let i = 0; i < count; i ++ ) {
                                                                scanline_buffer[ ptr ++ ] = byteValue;
                                                        }
                                                } else {
                                                        scanline_buffer.set( buffer.subarray( pos, pos + count ), ptr );
                                                        ptr += count; pos += count;
                                                }
                                        }

                                        const l = scanline_width;
                                        for ( let i = 0; i < l; i ++ ) {
                                                let off = 0;
                                                data_rgba[ offset ] = scanline_buffer[ i + off ];
                                                off += scanline_width;
                                                data_rgba[ offset + 1 ] = scanline_buffer[ i + off ];
                                                off += scanline_width;
                                                data_rgba[ offset + 2 ] = scanline_buffer[ i + off ];
                                                off += scanline_width;
                                                data_rgba[ offset + 3 ] = scanline_buffer[ i + off ];
                                                offset += 4;
                                        }
                                        num_scanlines --;
                                }
                                return data_rgba;
                        };

                const RGBEByteToRGBFloat = function ( sourceArray: Uint8Array, sourceOffset: number, destArray: Float32Array, destOffset: number ) { // Typed params
                        const e = sourceArray[ sourceOffset + 3 ];
                        const scale = Math.pow( 2.0, e - 128.0 ) / 255.0;
                        destArray[ destOffset + 0 ] = sourceArray[ sourceOffset + 0 ] * scale;
                        destArray[ destOffset + 1 ] = sourceArray[ sourceOffset + 1 ] * scale;
                        destArray[ destOffset + 2 ] = sourceArray[ sourceOffset + 2 ] * scale;
                        destArray[ destOffset + 3 ] = 1;
                };

                const RGBEByteToRGBHalf = function ( sourceArray: Uint8Array, sourceOffset: number, destArray: Uint16Array, destOffset: number ) { // Typed params
                        const e = sourceArray[ sourceOffset + 3 ];
                        const scale = Math.pow( 2.0, e - 128.0 ) / 255.0;
                        destArray[ destOffset + 0 ] = DataUtils.toHalfFloat( Math.min( sourceArray[ sourceOffset + 0 ] * scale, 65504 ) );
                        destArray[ destOffset + 1 ] = DataUtils.toHalfFloat( Math.min( sourceArray[ sourceOffset + 1 ] * scale, 65504 ) );
                        destArray[ destOffset + 2 ] = DataUtils.toHalfFloat( Math.min( sourceArray[ sourceOffset + 2 ] * scale, 65504 ) );
                        destArray[ destOffset + 3 ] = DataUtils.toHalfFloat( 1 );
                };

                const byteArray = new Uint8Array( buffer ) as Uint8ArrayWithPos; // Cast to include pos
                byteArray.pos = 0;
                const rgbe_header_info = RGBE_ReadHeader( byteArray );

                const w = rgbe_header_info.width,
                        h = rgbe_header_info.height,
                        image_rgba_data = RGBE_ReadPixels_RLE( byteArray.subarray( byteArray.pos ), w, h );

                let data: Float32Array | Uint16Array, type: typeof FloatType | typeof HalfFloatType; // Typed data and type
                let numElements;

                switch ( this.type ) {
                        case FloatType:
                                numElements = image_rgba_data.length / 4;
                                const floatArray = new Float32Array( numElements * 4 );
                                for ( let j = 0; j < numElements; j ++ ) {
                                        RGBEByteToRGBFloat( image_rgba_data, j * 4, floatArray, j * 4 );
                                }
                                data = floatArray;
                                type = FloatType;
                                break;
                        case HalfFloatType:
                                numElements = image_rgba_data.length / 4;
                                const halfArray = new Uint16Array( numElements * 4 );
                                for ( let j = 0; j < numElements; j ++ ) {
                                        RGBEByteToRGBHalf( image_rgba_data, j * 4, halfArray, j * 4 );
                                }
                                data = halfArray;
                                type = HalfFloatType;
                                break;
                        default:
                                throw new Error( 'THREE.RGBELoader: Unsupported type: ' + this.type );
                }

                return {
                        width: w, height: h,
                        data: data,
                        header: rgbe_header_info.string,
                        gamma: rgbe_header_info.gamma,
                        exposure: rgbe_header_info.exposure,
                        type: type
                };
        }

        /**
         * Sets the texture type.
         *
         * @param {(HalfFloatType|FloatType)} value - The texture type to set.
         * @return {RGBELoader} A reference to this loader.
         */
        setDataType( value: typeof FloatType | typeof HalfFloatType ): this { // Typed value and return
                this.type = value;
                return this;
        }

        load( url: string, onLoad?: (texture: THREE.DataTexture, texData: any) => void, onProgress?: (event: ProgressEvent) => void, onError?: (event: any) => void ) { // onError event type changed to any
                function onLoadCallback( texture: THREE.DataTexture, texData: any ) { // Typed params
                        switch ( texture.type ) {
                                case FloatType:
                                case HalfFloatType:
                                        texture.colorSpace = LinearSRGBColorSpace;
                                        texture.minFilter = LinearFilter;
                                        texture.magFilter = LinearFilter;
                                        texture.generateMipmaps = false;
                                        texture.flipY = true;
                                        break;
                        }
                        if ( onLoad ) onLoad( texture, texData );
                }
                return super.load( url, onLoadCallback, onProgress, onError );
        }
}
export { RGBELoader };
