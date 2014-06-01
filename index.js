'use strict';
module.exports =
function serialise(val) {
  var buf
    , len = 0

  if (val === undefined) return
  _serialise(val, write)
  return buf

  function write(chunk) {
    var chunkLen = chunk.length
    if (buf === undefined) {
      buf = chunk
      len = chunkLen
    }
    else {
      len += chunkLen
      buf = Buffer.concat([buf, chunk], len)
    }
  }
}

function _serialise(val, write) {
  var buf
    , len
    , i

  if (val === null)
    return write(new Buffer([0xC0]))

  if (typeof val == 'boolean')
    return write(header0(0xC2, val))

  if (typeof val == 'number') {
    // float 32
    if (val !== val | 0) {
      buf = new Buffer(5)
      buf[0] = 0xCA
      buf.writeFloatBE(val, 1, true)
      return write(buf)
    }

    // positive
    if (val >= 0) {
      // positive fixint
      if (val < 0x80)
        return write(header0(0x00, val))

      // uint 8
      if (val < 0x100)
        return write(header8(0xD0, val))

      // uint 16
      if (val <= 0xFFFF)
        return write(header16(0xD1, val))

      // uint 32
      return header32(0xD2, val)
    }

    // negative fixint
    if (val >= -0x20)
      return write(header0(0xE0, val + 0x20))

    // int 8
    if (val >= -0x80)
      return write(header8(0xD0, val & 0xFF))

    // int 16
    if (val >= -0x8000)
      return write(header16(0xD1, val))

    // int 32
    if (val >= -0x7fffffff)
      return write(header32(0xD2, val))
  }

  // str
  if (typeof val == 'string') {
    buf = new Buffer(val)
    len = buf.length

    // fixstr
    if (len <= 0x1F)
      return write(Buffer.concat([header0(0xA0, len), buf], 1 + len))

    // str 8
    if (len <= 0xFF)
      return write(Buffer.concat([header8(0xD9, len), buf], 1 + 1 + len))

    // str 16
    if (len <= 0xFFFF)
      return write(Buffer.concat([header16(0xDA, len), buf], 1 + 2 + len))

    // str 32
    return Buffer.concat([header32(0xDB, len), buf], 1 + 4 + len)
  }

  // bin
  if (Buffer.isBuffer(val)) {
    len = val.length

    // bin 8
    if (len <= 0xFF)
      return write(Buffer.concat([header8(0xC4, len), val], 1 + 1 + len))

    // bin 16
    if (len <= 0xFFFF)
      return write(Buffer.concat([header16(0xC5, len), val], 1 + 2 + len))

    // bin 32
    return Buffer.concat([header32(0xC6, len), val], 1 + 4 + len)
  }

  // array
  if (Array.isArray(val)) {
    len = val.length

    // fixarray
    if (len <= 0xF)
      write(header0(0x90, len))
    // array 16
    else if (len <= 0xFFFF)
      write(header16(0xDC, len))
    // array 32
    else
      write(header32(0xDD, len))

    for (i = 0; i < len; i++)
      _serialise(val[i], write)
    return
  }

  var keys = Object.keys(val)
  len = keys.length

  // fixmap
  if (len <= 0xF)
    write(header0(0x80, len))
  // map 16
  else if (len <= 0xFFFF)
    write(header16(0xDE, len))
  // map 32
  else
    write(header32(0xDF, len))

  for (i = 0; i < len; i++) {
    var key = keys[i]
    _serialise(key, write)
    _serialise(val[key], write)
  }
}

function header0(code, len) {
  return new Buffer([code | len])
}

function header8(code, len) {
  return new Buffer([code, len])
}

function header16(code, len) {
  var buf = new Buffer(1 + 2)
  buf[0] = code
  buf.writeUInt16BE(len, 1, true)
  return buf
}

function header32(code, len) {
  var buf = new Buffer(1 + 4)
  buf[0] = code
  buf.writeUInt32BE(len, 1, true)
  return buf
}
