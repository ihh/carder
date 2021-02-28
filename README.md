# carder

This project contains several modules: Carder, Dealer, and FakeCarder.

I would be potentially interested in collaborating with a writer to develop a more substantial
interactive fiction game using this code (which could be what nudges this into becoming a higher-priority commitment for me).

## Carder

Carder is a basic, low-level API suitable for building a bare-bones card-swiping interactive fiction story,
_a la_ "Rei*ns".
It combines Gajus Kuizinas' card-swiping library [Swing](https://github.com/gajus/swing)
with some simple user interface elements (hints, meters, status page).

A card can have any text on it (font will be auto-sized to fit).
Each card offers a binary choice: swipe left or swipe right.
The player makes a choice by swiping (dragging) the card left or right, or by clicking and then confirming the "left" and "right" arrows at the bottom of the screen.

At the top of the screen are _meters_ displaying the player's stats.
Tapping the meter bar will rotate the card table to show configurable status text.

The left and right choices can each have _hints_ (short pieces of text which appear on the arrows that periodically appear to prompt the user to swipe),
_previews_ (longer pieces of text that appear on the bottom while dragging, or waiting for confirmation),
and _meter previews_ (which hint at the effect of the choice on the meters by changing their color during preview).
Finally, each choice has an associated callback function, that is called when the choice is made, allowing another card to be dealt.

The Carder API is deliberately minimal, focusing just on the UI, and leaving the game logic to a different module
(see Dealer, below).

For a basic demo (illustrating only the functionality, no content) see [here](https://ihh.github.io/carder/).

~~~~
$(document).ready (() => {
  c = new Carder ({ parent: "carder" })   // add to parent element with ID 'carder'
  let coins = 0.5, castle = 0.5
  c.setStatus (() => `You have ${coins} coins and ${castle} castles.`)
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

Dealer is a basic game engine built on top of Carder, essentially a big state machine with a collection of cards at each node.
It transparently handles persistence of game state over page reloads,
as well as a few other things (like automatically hooking up previews and consequences for choices that affect meter stats,
sequencing cards, batching cards, and a set of flexible conditions under which cards can be presented which include
priorities, probabilities (which can be dynamically computed from the current game state),
and various flags and modifiers e.g. allowing cards to be dealt only before/after a certain amount of moves,
or limiting the number of times they can be used,
or preventing them from being repeated consecutively by having a cooldown period, etc.)

Dealer does not add to the Carder UI, and can be run with FakeCarder instead of Carder to test from the command line
(with lots of debugging info).

A basic demo with a few boring test cards is [here](https://ihh.github.io/carder/example/).

Here's the code from that demo, which gives a bit of a flavor of the API (just nonsense text, sorry, this was more of an API test than an actual worked example):

~~~~
let c, d
$(document).ready (() => {
  c = new Carder ({ iconPrefix: '../img/' })
  const config = {
    carder: c,
    debug: true,
    meterIconPrefix: '../meters/',
    meters: [{ name: 'coins' },
             { name: 'castle' }],
    cards: [{ html: 'hello', priority: 2, limit: 1, left: { reward: { coins: .1 } } },
            { html: 'world', priority: 1, limit: 1 },
            { when: 'start',
              className: 'title',
              cards: [{ html: 'filler', cool: 1 },
                      { html: 'test card',
                        limit: 2,
                        cool: 1,
                        left: { scaledReward: { coins: .1 }, sequence: { className: 'bonus', cards: [{className:"warning",html:"one"},["two",2],"three"] } },
                        right: { stage: 'muppet', scaledReward: { coins: -.1 }, reward: { castle: .2 } } }] },
                      { html: 'Time passes...', priority: -1 }],
    status: (gs) => `Coins=${gs.coins} Castle=${gs.castle}` }
  d = new Dealer (config)
  d.dealFirstCard()
})
~~~~

### Dealer documentation

_To do: write proper Dealer documentation_

Here's some very bare-bones documentation from the source code

~~~
A 'cardSet' is an array of cards or staged cardSets, representing a collection of cards.
A 'sequence' is an array of cardSets lacking a 'when' property (it's auto-assigned). If any of the left/right objects change gameState.stage, then the sequence will be derailed.

Anywhere a cardSet or sequence can appear, there can alternatively be an object with a 'cards' property (that is an array), and any subset of the card properties listed below.
These properties are then inherited by all the cards in the 'cards' list.

Card properties include
     weight: number, or callback which is passed the current gameState
   priority: zero by default. Only cards with the highest priority and nonzero weight are eligible to be dealt
       when: if present, must be a string (split into array of strings), one of which must match the last element of the gameState.stage array
       html: string, or callback to generate content from current gameState
  className: string
left, right: optional swiper objects that can contain { hint, preview, meters, reward, scaledReward, stage, push, pop, cb, card, sequence, cardSet }
       cool: cooling-off period i.e. number of cards dealt *from the same stage* before the card can be dealt again
limit, minTurnsAtStage, maxTurnsAtStage, minTotalTurnsAtStage, maxTotalTurnsAtStage, minTurns, maxTurns:
             limit when/how many times a particular card can be dealt.

Anywhere a card can go, there can just be a string, which is assumed to be the card's html; the card has no swipers (left & right attributes).
There can also just be a function, in which case it is evaluated (with gameState as argument) and then treated as if it were just a string.

Meter properties are as in Carder, but the 'level' callback is passed a gameState
Alternatively, if meter has no 'level' but has {min,max,init}, a property with the same name as the meter will be added to gameState, and its level autocomputed
If a swiper has a 'reward' property, then this is used as a name=>delta map for the meter, and the preview auto-generated.
'scaledReward' is the same but auto-scales the reward so it is smaller near the top or bottom of the range.
~~~

## Misc credits

Icons from https://game-icons.net/
