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
  this.meters = []

  readline.emitKeypressEvents (process.stdin)
  process.stdin.setRawMode (true)

  process.stdin.on ('keypress', (str, key) => {
    if (key.name === 'escape' || (key.ctrl && (key.name === 'c' || key.name === 'd' || key.name === 'z')))
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

function previewSwiper (title, swiper) {
  console.log (title + ':')
  if (swiper.hint)
    console.log (" Hint: " + swiper.hint)
  if (swiper.preview)
    console.log (" Preview: " + swiper.preview)
  if (swiper.meters)
    console.log (" Meters: " + Object.keys(swiper.meters).map ((name) => name + (swiper.meters[name] > 0 ? '+' : '-')).join(' '))
}

extend (FakeCarder.prototype, {
  addMeter: function (meter) {
    this.meters.push (meter)
  },

  dealCard: function (config) {
    const left = config.left || {}
    const right = config.right || {}
//    console.log()
//    console.log (config)
    if (this.meters.length)
      console.log ("Meters: " + this.meters.map ((meter) => meter.name + '(' + meter.level() + ')').join(' ' ))
    console.log ("Card: " + config.html)
    previewSwiper ("Left", left)
    previewSwiper ("Right", right)
    this.leftCallback = left.cb
    this.rightCallback = right.cb
  }
})

module.exports = FakeCarder
