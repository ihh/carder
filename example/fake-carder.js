const readline = require ('readline')

function extend(dest, src, merge) {
  var keys = Object.keys(src);
  var i = 0;
  while (i < keys.length) {
    if (!merge || (merge && dest[keys[i]] === undefined)) {
      dest[keys[i]] = src[keys[i]];
    }
    i++;
  }
  return dest;
}

function deleteAndCall (obj, id) {
  const cb = obj[id]
  if (cb) {
    delete obj[id]
    cb()
  }
}

const FakeCarder = function (config) {
  readline.emitKeypressEvents (process.stdin)
  process.stdin.setRawMode (true)

  process.stdin.on ('keypress', (str, key) => {
    if (key.ctrl && (key.name === 'c' || key.name === 'd'))
      process.exit()
    else if (key.name === 'left' || key.name === 'right') {
      console.log ('<' + key.name + '>')
      const id = key.name === 'left' ? 'leftCallback' : 'rightCallback'
      const cb = this[id]
      if (cb) {
        delete this[id]
        cb()
      }
    } else if (key.str)
      process.stdout.write (key.str)
  })
}

extend (FakeCarder.prototype, {
  dealCard: function (config) {
    const left = config.left || {}
    const right = config.right || {}
    console.log()
    //    console.log(config)
    console.log (config.html)
    console.log ("Left: " + (left.preview || "<no preview>"))
    console.log ("Right: " + (right.preview || "<no preview>"))
    this.leftCallback = left.cb
    this.rightCallback = right.cb
  }
})

module.exports = FakeCarder
