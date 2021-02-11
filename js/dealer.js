// Provide Dealer with cards, meters

// A cardSet is one of the following:
// - an array of cards
// - an object with {when,cards} properties ('when' is auto-assigned to all cards in list)

// Card properties
//      weight: number, or callback which is passed the current gameState
//        when: if present, must be a string (split into array of strings), one of which must match the last element of the gameState.stage array
//        html: string, or callback to generate content from current gameState
//   className: string
// left, right: optional swiper objects that can contain { hint, preview, meters, reward, stage, push, pop, cb, card, sequence, cardSet }

// Anywhere a card can go, there can just be a string, which is assumed to be the card's html; the card has no swipers (left & right attributes).
// There can also just be a function, in which case it is evaluated (with gameState as argument) and then treated as if it were just a string.

// A 'sequence' is an array of cardSets lacking a 'when' property (it's auto-assigned). If any of the left/right objects change gameState.stage, then the sequence will be derailed.

// Meter properties are as in Carder, but the 'level' callback is passed a gameState
// Alternatively, if meter has no 'level' but has {min,max,init}, a property with the same name as the meter will be added to gameState, and its level autocomputed
// If a swiper has a 'reward' property, then this is used as a name=>delta map for the meter, and the preview auto-generated.

const Dealer = (() => {

  // helpers
  function isArray(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]'
  }

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

  const isBrowser = new Function ("try {return this===window;}catch(e){ return false;}")
  const isNode = new Function("try {return this===global;}catch(e){return false;}")
  
  // Dealer
  const Dealer = function (config) {
    let dealer = this
    if (!config)
      throw new Error ("Dealer needs a configuration object")
    let carder = config.carder,
        cards = config.cards,
        meters = config.meters || []
    if (!carder)
      throw new Error ("Dealer needs a Carder")
    if (!cards)
      throw new Error ("Dealer needs cards")

    extend (this, {
      carder,
      cards: [],
      meters: {},
      anonStageCount: 0,
      gameState: extend ({
        stage: [this.startStage]
      }, config.gameState || {})
    })

    // flatten nested sequences & cardSets, assign stages, wrap callbacks
    this.flattenCardSet (cards)
    this.cards.forEach ((card) => {
      card.left = card.left || {}
      card.right = card.right || {}
      this.makeCallbacks (card.left)
      this.makeCallbacks (card.right)
    })

    // create meters
    meters.forEach ((meter) => {
      if (!meter.icon)
        meter.icon = this.defaultIconPathPrefix + meter.name + this.defaultIconPathSuffix
      if (meter.level)
        carder.addMeter ({ name: meter.name,
                           icon: meter.icon,
                           level: () => meter.level (this.gameState) })
      else {
        this.meter[meter.name] = meter
        if (typeof(meter.min) === 'undefined' && typeof(meter.max) === 'undefined')
          extend (meter, { min: 0, max: 1 })
        if (typeof(meter.min) === 'undefined' && meter.max > 0)
          meter.min = 0
        this.gameState[meter.name] = typeof(meter.init) === 'undefined' ? ((meter.max + meter.min) / 2) : meter.init
        carder.addMeter ({ name: meter.name,
                           icon: meter.icon,
                           level: () => Math.min (1, Math.max (0, (this.gameState[meter.name] - meter.min) / (meter.max - meter.min))) })
      }
    })

    // return from constructor
    return this
  }

  extend (Dealer.prototype, {
    // configuration
    startStage: 'start',
    defaultIconPathPrefix: 'img/',
    defaultIconPathSuffix: '.svg',
    
    // methods
    newAnonStage: function() {
      return '!' + (this.anonStageCount++)
    },

    flattenCardSet: function (cardSet, stage) {
      if (isArray(cardSet)) {
        cardSet.forEach ((card) => this.flattenCard (card, stage))
        return cardSet
      }
      return this.flattenCardSet (cardSet.cards, cardSet.when)
    },

    flattenCard: function (card, stage) {
      if (typeof(card) === 'string' || typeof(card) === 'function')
        card = { html: this.evalString (card) }
      
      let when = card.when || stage
      card.when = when ? when.split(/\s+/) : undefined
      if (card.next)
        card.left = card.right = card.next
      this.cards.push (card)
      if (card.left)
        this.flattenSwiper (card.left)
      if (card.right && card.right !== card.left)
        this.flattenSwiper (card.right)
    },

    flattenSwiper: function (swiper) {
      if (swiper.sequence) {
        swiper.push = this.newAnonStage()
        this.flattenSequence (swiper.sequence, swiper.push)
      } else if (swiper.card) {
        swiper.stage = this.newAnonStage()
        this.flattenCard (swiper.card, swiper.stage)
      } else if (swiper.cardSet) {
        swiper.stage = this.newAnonStage()
        this.flattenCardSet (swiper.cardSet, swiper.stage)
      }
    },

    flattenSequence: function (sequence, stage) {
      let stages = [], cardSets = []
      sequence.forEach ((cardSet, n) => {
        cardSets.push (this.flattenCardSet (cardSet, stage))
        stages.push (stage)
        if (n !== sequence.length - 1)
          stage = this.newAnonStage()
      })
      // hook up each step in the sequence to the next
      cardSets.forEach ((cardSet, n) => {
        cardSet.forEach ((card) => card.pop = true)
        if (n < sequence.length - 1) {
          const next = stages[n+1]
          cardSet.forEach ((card) => {
            if (card.left && !card.left.stage)
              card.left.push = card.left.push || next
            if (card.right && !card.right.stage)
              card.right.push = card.right.push || next
          })
        }
      })
    },

    makeCallbacks: function (swiper) {
      let dealer = this
      let userCallback = swiper.cb || function(){}
      swiper.cb = () => {
        userCallback (dealer.gameState, dealer)
        // TODO: smart update of meters (with automatic hints)
        if (swiper.pop)
          dealer.gameState.stage.pop()
        if (swiper.push)
          dealer.gameState.stage.push (swiper.push)
        if (swiper.stage)
          dealer.gameState.stage = [swiper.stage]
        dealer.nextCard()
      }
    },
    
    currentStage: function() {
      return this.gameState.stage.length > 0 ? this.gameState.stage[this.gameState.stage.length - 1] : undefined
    },
    
    nextCard: function() {
      let dealer = this
      let stage = this.currentStage(), gameState = this.gameState
      console.log()
      console.log({gameState,stage})
      let cardWeight = this.cards.map ((card) => {
        if (card.when && card.when.length && card.when.filter ((when) => when === stage).length === 0)
          return 0
        let w = card.weight
        if (typeof(w) === 'undefined')
          return 1
        if (typeof(w) === 'function')
          w = w (gameState, dealer)
        return typeof(w) === 'number' ? w : 0
      })
      const template = this.cards[this.sampleByWeight (cardWeight)]
      if (typeof(template) !== 'undefined') {
        let card = {
          html: this.evalString (template.html),
          className: template.className,
          left: this.evalSwiper (template.left),
          right: this.evalSwiper (template.right)
        }

        this.carder.dealCard (card)
      }
    },

    eval: function (x) {
      return typeof(x) === 'function' ? x(this.gameState,this) : x
    },
    
    evalString: function (x) {
      return typeof(x) === 'undefined' ? undefined : this.eval(x).toString()
    },

    evalNumber: function (x) {
      return typeof(x) === 'undefined' ? 0 : parseFloat (this.eval(x))
    },

    evalSwiper: function (template) {
      if (!template)
        return undefined
      let swiper = { hint: this.evalString (template.hint),
                     preview: this.evalString (template.preview) }
      let meterDelta
      if (template.reward) {
        swiper.meters = {}
        meterDelta = {}
        Object.keys(template.reward).forEach ((name) => {
          const delta = this.evalNumber (template.reward[name])
          const meter = this.meter[name], oldLevel = this.gameState[name]
          const boundedDelta = delta * (meter.max - oldLevel) / (meter.max - meter.min)  // c.f. https://choicescriptdev.fandom.com/wiki/Arithmetic_operators
          if (boundedDelta) {
            meterDelta[name] = boundedDelta
            swiper.meters[name] = Math.sign(boundedDelta)
          }
        })
      }
      if (template.cb || template.meters)
        swiper.cb = (gameState, dealer) => {
          if (template.meters)
            Object.keys(meterDelta).forEach ((name) => {
              gameState[name] += meterDelta[name]
            })
          if (template.cb)
            template.cb (gameState, dealer)
        }
      return swiper
    },
    
    sampleByWeight: function (weights) {
      let totalWeight = weights.reduce (function (total, w) { return total + w }, 0)
      if (totalWeight) {
        let w = totalWeight * Math.random()
        for (let i = 0; i < weights.length; ++i)
          if ((w -= weights[i]) <= 0)
	    return i
      }
      return undefined
    },

  })

  if (isNode())
    module.exports = Dealer
  
  return Dealer
})()
