# carder

This project contains several modules: Carder, Dealer, and FakeCarder.

## Carder

Carder is a basic, low-level API suitable for building a bare-bones card-swiping interactive fiction story,
_a la_ "Rei*ns".
It combines Gajus Kuizinas' card-swiping library [Swing](https://github.com/gajus/swing)
with some simple user interface elements (hints, meters, status page).

For a basic demo (illustrating only the functionality, no content) see [here](https://ihh.github.io/carder/).

~~~~
$(document).ready (() => {
  c = new Carder ({ parent: "carder" })   // add to parent element with ID 'carder'
  let coins = 0.5, castle = 0.5
  c.addMeter ({ name: 'coins', icon: 'meters/coins.svg', level: () => coins })
  c.addMeter ({ name: 'castle', icon: 'meters/castle.svg', level: () => castle })
  function deal (message) {
    message = message || '<i>Demo card</i>'
    c.dealCard ({
      html: message,
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

## FakeCarder

FakeCarder has an identical API to Carder, but can be run on the command-line instead of the web browser. It is useful for debugging.

## Dealer

Dealer is a basic game engine for Carder, essentially a big state machine with a collection of cards at every node.

_To do: write Dealer documentation_

## Misc credits

Icons from https://game-icons.net/
