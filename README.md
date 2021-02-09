# carder

A lightweight hack that takes @gajus' [Swing](https://github.com/gajus/swing)
and adds some user interface elements (hints, meters)
suitable for building a bare-bones card-swiping interactive fiction story,
_a la_ "Rei*ns".

~~~~
$(document).ready (() => {
  c = new Carder ({ parent: "carder" })
  let coins = 0.5, castle = 0.5
  c.addMeter ({ name: 'coins', icon: 'meters/coins.svg', level: () => coins })
  c.addMeter ({ name: 'castle', icon: 'meters/castle.svg', level: () => castle })
  function deal (message) {
    message = message || '<i>Demo card</i>'
    c.dealCard ({ html: message,
      left: {
        hint: 'left',
        preview: "I'm swiping left.",
        cb: () => { coins *= .9; deal ('You swiped left') }
      },
      right: {
        hint: 'right',
        preview: "I'm swiping right.",
        cb: () => { castle = 1 - (1 - castle) * .9; deal ('You swiped right') }
      }
  })
}
deal()
~~~~