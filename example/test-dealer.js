#!/usr/bin/env node

const Dealer = require('../js/dealer.js')
const FakeCarder = require('./fake-carder.js')

let c = new FakeCarder()

const config = {
  carder: c,
  cards: [{ html: 'test card',
            stage: 'start',
            left: { stage: 'man' },
            right: { stage: 'muppet' } }]
}

let d = new Dealer (config)
d.nextCard()
