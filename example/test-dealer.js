#!/usr/bin/env node

const Dealer = require('../js/dealer.js')
const FakeCarder = require('./fake-carder.js')

let c = new FakeCarder ({ status: (s) => console.log(s) })

const config = {
  carder: c,
  meters: [{ name: 'coins' },
           { name: 'castle' }],
  cards: [{ html: 'hello', priority: 2, limit: 1 },
          { html: 'world', priority: 1, limit: 1 },
          { when: 'start',
            cards: [{ html: 'filler', cool: 1 },
                    { html: 'test card',
                      limit: 2,
                      cool: 1,
                      left: { scaledReward: { coins: .1 }, sequence: ["one",["two",2],"three"] },
                      right: { stage: 'muppet', scaledReward: { coins: -.1 }, reward: { castle: .2 } } }] }],
  status: (gs) => `Coins=${gs.coins} Castle=${gs.castle}`
}

let d = new Dealer (config)
d.dealFirstCard()
