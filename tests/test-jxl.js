const fs = require('fs')
const path = require('path')

// Simple JXL detection function (copied from archive.js)
const isJxl = (buf) => buf && buf.length >= 12 &&
  buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x00 && buf[3] === 0x0C &&
  buf[4] === 0x4A && buf[5] === 0x58 && buf[6] === 0x4C && buf[7] === 0x20 &&
  buf[8] === 0x0D && buf[9] === 0x0A && buf[10] === 0x87 && buf[11] === 0x0A

async function testJxlDecoding() {
  console.log('Testing JXL decoding functionality...')

  // Create a simple JXL header buffer for testing isJxl function
  const jxlHeader = Buffer.from([
    0x00, 0x00, 0x00, 0x0C, // JXL signature
    0x4A, 0x58, 0x4C, 0x20, // "JXL "
    0x0D, 0x0A, 0x87, 0x0A  // rest of signature
  ])

  console.log('Testing isJxl function:')
  console.log('JXL header detected:', isJxl(jxlHeader))
  console.log('Empty buffer detected:', isJxl(Buffer.alloc(0)))
  console.log('Non-JXL buffer detected:', isJxl(Buffer.from([0xFF, 0xD8, 0xFF]))) // JPEG header

  // Test djxl.exe availability
  const djxlPath = path.join(__dirname, 'resources/extraResources/djxl.exe')
  console.log('\nTesting djxl.exe availability:')
  console.log('djxl.exe exists:', fs.existsSync(djxlPath))

  if (fs.existsSync(djxlPath)) {
    console.log('djxl.exe version check:')
    try {
      const { spawn } = require('child_process')
      const djxl = spawn(djxlPath, ['--version'], { stdio: 'pipe' })

      let stdout = ''
      let stderr = ''

      djxl.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      djxl.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      djxl.on('close', (code) => {
        if (code === 0) {
          console.log('djxl version output:', stdout.trim())
        } else {
          console.log('djxl version check failed:', stderr.trim())
        }
      })
    } catch (error) {
      console.log('Error checking djxl version:', error.message)
    }
  }

  console.log('\nJXL decoding test completed!')
}

testJxlDecoding().catch(console.error)
