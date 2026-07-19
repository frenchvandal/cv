//! Ordered-dithering background engine, compiled to `wasm32-unknown-unknown`.
//!
//! `#![no_std]`, no allocator, no wasm-bindgen: raw `extern "C"` exports over
//! a static arena. The host (JS) calls `init`/`resize` once, then `render`
//! per frame and reads the RGBA bytes via `frame_ptr`/`frame_len`.

#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo<'_>) -> ! {
    // release profile uses panic = "abort"; this is unreachable in practice.
    loop {}
}

// ---------------------------------------------------------------------------
// Limits & state
// ---------------------------------------------------------------------------

const MAX_COLS: i32 = 640;
const MAX_ROWS: i32 = 400;
const MAX_CELLS: usize = (MAX_COLS as usize) * (MAX_ROWS as usize); // 256_000
const FRAME_BYTES: usize = MAX_CELLS * 4; // 1_024_000 (zero-init -> wasm bss)

static mut FRAME: [u8; FRAME_BYTES] = [0; FRAME_BYTES];
static mut COLS: i32 = 0;
static mut ROWS: i32 = 0;
static mut SEED: u32 = 0;

fn frame_ptr_mut() -> *mut u8 {
    // addr_of_mut! avoids creating a reference to a static mut.
    core::ptr::addr_of_mut!(FRAME) as *mut u8
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Classic 8x8 Bayer ordered-dither threshold matrix.
const BAYER8: [u8; 64] = [
    0, 32, 8, 40, 2, 34, 10, 42, //
    48, 16, 56, 24, 50, 18, 58, 26, //
    12, 44, 4, 36, 14, 46, 6, 38, //
    60, 28, 52, 20, 62, 30, 54, 22, //
    3, 35, 11, 43, 1, 33, 9, 41, //
    51, 19, 59, 27, 49, 17, 57, 25, //
    15, 47, 7, 39, 13, 45, 5, 37, //
    63, 31, 55, 23, 61, 29, 53, 21,
];

/// Quantization levels for the ordered dither.
const LEVELS: f64 = 5.0;
const MAX_LEVEL: i32 = 4;

/// Dark theme: black bg up to soft white. Cloud cores dither into the top
/// tones only near the frame edges (see the radial mask in `cell_luminance`),
/// so the central content zone stays readable.
const DARK_TONES: [u8; 5] = [0x00, 0x16, 0x3a, 0x8c, 0xf2]; // #000000 .. #f2f2f2
/// Light theme (flags bit 0): #fafafa bg, dark grays down to #0a0a0a.
const LIGHT_TONES: [u8; 5] = [0xfa, 0xe6, 0xc4, 0x74, 0x0a]; // #fafafa .. #0a0a0a

const FLAG_LIGHT: u32 = 1;

/// Noise feature size: ~58 cells per lattice step (big billowing masses).
const SCALE: f64 = 1.0 / 58.0;
/// Cloud drift per millisecond (x fast, y slower, different rate).
const DRIFT_X: f64 = 0.00002;
const DRIFT_Y: f64 = 0.000013;

// ---------------------------------------------------------------------------
// Math helpers (pure core, no std float methods)
// ---------------------------------------------------------------------------

fn floor(x: f64) -> f64 {
    let t = x as i64; // saturating cast, truncates toward zero
    let tf = t as f64;
    if tf > x {
        tf - 1.0
    } else {
        tf
    } // fix negative fractions
}

fn clamp01(x: f64) -> f64 {
    // `f64::clamp` is a core inherent method — no std needed.
    x.clamp(0.0, 1.0)
}

/// Triangle wave of the fractional part, in [0,1]. Cheap twinkle oscillator.
fn tri(x: f64) -> f64 {
    let f = x - floor(x);
    if f < 0.5 {
        f * 2.0
    } else {
        2.0 - f * 2.0
    }
}

/// Hermite smoothstep between edges `a` and `b` (pure arithmetic, no sqrt).
fn smoothstep(a: f64, b: f64, x: f64) -> f64 {
    let s = clamp01((x - a) / (b - a));
    s * s * (3.0 - 2.0 * s)
}

// ---------------------------------------------------------------------------
// Hash & value noise
// ---------------------------------------------------------------------------

/// Integer lattice hash (splitmix-style finalizer on u32, wrapped i32 space).
fn hash_cell(ix: i32, iy: i32, seed: u32) -> u32 {
    let mut h =
        (ix as u32).wrapping_mul(0x9E37_79B9) ^ (iy as u32).wrapping_mul(0x85EB_CA6B) ^ seed;
    h ^= h >> 16;
    h = h.wrapping_mul(0x21F0_AAAD);
    h ^= h >> 15;
    h = h.wrapping_mul(0x735A_2D97);
    h ^= h >> 15;
    h
}

fn hash01(ix: i32, iy: i32, seed: u32) -> f64 {
    (hash_cell(ix, iy, seed) >> 8) as f64 * (1.0 / 16_777_216.0) // top 24 bits
}

/// Smoothstep-interpolated value noise on the integer lattice.
fn value_noise(x: f64, y: f64, seed: u32) -> f64 {
    let x0 = floor(x) as i32;
    let y0 = floor(y) as i32;
    let fx = x - x0 as f64;
    let fy = y - y0 as f64;
    let sx = fx * fx * (3.0 - 2.0 * fx);
    let sy = fy * fy * (3.0 - 2.0 * fy);
    let v00 = hash01(x0, y0, seed);
    let v10 = hash01(x0.wrapping_add(1), y0, seed);
    let v01 = hash01(x0, y0.wrapping_add(1), seed);
    let v11 = hash01(x0.wrapping_add(1), y0.wrapping_add(1), seed);
    let top = v00 + (v10 - v00) * sx;
    let bot = v01 + (v11 - v01) * sx;
    top + (bot - top) * sy
}

/// 4-octave FBM, persistence 0.5, normalized to [0,1].
fn fbm4(x: f64, y: f64, seed: u32) -> f64 {
    let mut sum = 0.0;
    let mut amp = 0.5;
    let mut fx = x;
    let mut fy = y;
    for oct in 0..4u32 {
        let oseed = seed.wrapping_add(oct.wrapping_mul(0x9E37_79B9));
        sum += amp * value_noise(fx, fy, oseed);
        fx *= 2.03; // slight detune avoids axis-aligned repetition
        fy *= 1.97;
        amp *= 0.5;
    }
    sum * (1.0 / 0.9375)
}

// ---------------------------------------------------------------------------
// Shading
// ---------------------------------------------------------------------------

/// Continuous luminance in [0,1] for one cell: FBM clouds + sparse stars.
///
/// Composition mirrors the Moonshot/Kimi hero: bold cloud masses hug the
/// frame edges and corners while the center stays a readable void. `edge`
/// is a radial mask on the aspect-normalized distance² from center (no sqrt
/// in `core`), and `intensity` (0..1) is the per-panel drama dial — the deck
/// turns it up on the hero/contact panels and down on dense content.
fn cell_luminance(
    x: i32,
    y: i32,
    t_ms: f64,
    seed: u32,
    cols: i32,
    rows: i32,
    intensity: f64,
) -> f64 {
    let px = x as f64 * SCALE + t_ms * DRIFT_X;
    let py = y as f64 * SCALE + t_ms * DRIFT_Y;
    let raw = fbm4(px, py, seed);

    // 0 at center, 1 at edge midpoints, 2 in the corners.
    let nx = (x as f64 + 0.5) * 2.0 / cols as f64 - 1.0;
    let ny = (y as f64 + 0.5) * 2.0 / rows as f64 - 1.0;
    let edge = smoothstep(0.30, 1.30, nx * nx + ny * ny);

    // Faint wisps texture the whole frame; contrast-curved billows carry the
    // drama, gated to the edges and scaled by the panel intensity.
    let wisp = raw * 0.30;
    let gain = intensity * (0.18 + 0.82 * edge);
    let mass = smoothstep(0.42, 0.80, raw) * gain;
    let cloud = if wisp > mass { wisp } else { mass };

    // Sparse static starfield: ~0.7% of cells.
    let sh = hash01(x, y, seed ^ 0xA511_E9B3);
    if sh > 0.993 {
        let phase = hash01(x, y, seed ^ 0xB529_7A4D);
        let tw = tri(t_ms * 0.00035 + phase * 7.0); // slow per-star twinkle
        let bright = (sh - 0.993) * (1.0 / 0.007); // 0..1 across star cells
        let star = 0.60 + 0.40 * bright * (0.35 + 0.65 * tw);
        if star > cloud {
            return star;
        }
    }
    cloud
}

/// Ordered dithering: quantize v + (bayer/64 - 0.5)/LEVELS into LEVELS steps.
fn quantize(v: f64, x: i32, y: i32) -> usize {
    let b = BAYER8[(((y & 7) << 3) | (x & 7)) as usize] as f64;
    let q = v + (b * (1.0 / 64.0) - 0.5) * (1.0 / LEVELS);
    let l = floor(q * LEVELS) as i32;
    if l < 0 {
        0
    } else if l > MAX_LEVEL {
        MAX_LEVEL as usize
    } else {
        l as usize
    }
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

fn valid(cols: i32, rows: i32) -> bool {
    cols > 0 && rows > 0 && cols <= MAX_COLS && rows <= MAX_ROWS
}

fn zero_frame(cells: i32) {
    unsafe { core::ptr::write_bytes(frame_ptr_mut(), 0u8, cells as usize * 4) };
}

/// Store dims + seed, zero the frame. 0 on success, -1 if dims exceed MAX.
#[no_mangle]
pub extern "C" fn init(cols: i32, rows: i32, seed: u32) -> i32 {
    if !valid(cols, rows) {
        return -1;
    }
    unsafe {
        COLS = cols;
        ROWS = rows;
        SEED = seed;
    }
    zero_frame(cols * rows);
    0
}

/// Same validation as `init`, keeps the current seed.
#[no_mangle]
pub extern "C" fn resize(cols: i32, rows: i32) -> i32 {
    if !valid(cols, rows) {
        return -1;
    }
    unsafe {
        COLS = cols;
        ROWS = rows;
    }
    zero_frame(cols * rows);
    0
}

/// Fill the RGBA frame buffer.
///
/// mode 0: nebula (animated FBM clouds + stars, Bayer 8x8 dithered)
/// mode 1: wipe (fullscreen Bayer transition mask, flat fg/bg colors)
/// mode 2: static (nebula frozen at t = 0)
/// flags bit 0: light theme (inverted palette)
/// intensity 0..1: cloud drama dial (per-panel; stars are unaffected)
#[no_mangle]
pub extern "C" fn render(t_ms: f64, mode: i32, blend: f64, flags: u32, intensity: f64) {
    let cols = unsafe { COLS };
    let rows = unsafe { ROWS };
    let seed = unsafe { SEED };
    if cols <= 0 || rows <= 0 {
        return;
    }
    let light = (flags & FLAG_LIGHT) != 0;
    let t = if mode == 2 { 0.0 } else { t_ms };
    let blend = clamp01(blend);
    let intensity = clamp01(intensity);
    let ptr = frame_ptr_mut();

    let mut idx = 0usize;
    for y in 0..rows {
        for x in 0..cols {
            let gray = if mode == 1 {
                let b = BAYER8[(((y & 7) << 3) | (x & 7)) as usize] as f64;
                let on = b * (1.0 / 64.0) < blend;
                match (light, on) {
                    (false, true) => 0xf2,  // dark fg #f2f2f2
                    (false, false) => 0x00, // dark bg #000000
                    (true, true) => 0x0a,   // light fg #0a0a0a
                    (true, false) => 0xfa,  // light bg #fafafa
                }
            } else {
                let v = cell_luminance(x, y, t, seed, cols, rows, intensity);
                let level = quantize(v, x, y);
                if light {
                    LIGHT_TONES[level]
                } else {
                    DARK_TONES[level]
                }
            };
            unsafe {
                let p = ptr.add(idx);
                p.write(gray);
                p.add(1).write(gray);
                p.add(2).write(gray);
                p.add(3).write(255);
            }
            idx += 4;
        }
    }
}

/// Pointer to the RGBA frame buffer (valid for the current grid dims).
#[no_mangle]
pub extern "C" fn frame_ptr() -> *const u8 {
    frame_ptr_mut() as *const u8
}

/// Byte length of the RGBA frame for the current grid dims (cols*rows*4).
#[no_mangle]
pub extern "C" fn frame_len() -> i32 {
    unsafe { COLS * ROWS * 4 }
}
