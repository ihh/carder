#!/usr/bin/env node

const Dealer = require('../js/dealer.js')
const FakeCarder = require('./fake-carder.js')

let c = new FakeCarder()

const config = {
  carder: c,
  meters: [{ name: 'coins' },
           { name: 'castle' }],
  cards: [{ html: 'test card',
            stage: 'start',
            left: { stage: 'man', scaledReward: { coins: .1 } },
            right: { stage: 'muppet', scaledReward: { coins: -.1 }, reward: { castle: .2 } } }]
}

let d = new Dealer (config)
d.nextCard()
