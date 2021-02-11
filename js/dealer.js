// Provide Dealer with cards, meters

// A cardSet is one of the following:
// - an array of cards
// - an object with {when,cards} properties ('when' is auto-assigned to all cards in list)

// Card properties
//      weight: number, or callback which is passed the current gameState
//        when: if present, must be a string (split into array of strings), one of which must match the last element of the gameState.stage array
//        html: string, or callback to generate content from current gameState
//   className: string
// left, right: optional objects that can contain { hint, preview, meters, stage, push, pop, cb, card, sequence, cardSet }

// A 'sequence' is an array of cardSets lacking a 'when' property (it's auto-assigned). If any of the left/right objects change gameState.stage, then the sequence will be derailed.

// Meter properties are as in Carder, but the 'level' callback is passed a gameState

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
    meters.forEach ((meter) =>
      carder.addMeter ({ name: meter.name,
                         icon: meter.icon,
                         level: () => meter.level (dealer.gameState) }))
    
    // return from constructor
    return this
  }

  extend (Dealer.prototype, {
    // config
    startStage: 'start',
    
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
      console.warn({gameState,stage})
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

      let card = {
        html: this.evalString (template.html),
        className: template.className,
        left: this.evalSwiper (template.left),
        right: this.evalSwiper (template.right)
      }

      this.carder.dealCard (card)
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
      return { hint: this.evalString (template.hint),
               preview: this.evalString (template.preview),
               meters: template.meters,
               cb: template.cb }
    },
    
    sampleByWeight: function (weights) {
      let totalWeight = weights.reduce (function (total, w) { return total + w }, 0)
      let w = totalWeight * Math.random()
      for (let i = 0; i < weights.length; ++i)
        if ((w -= weights[i]) <= 0)
	  return i
      return undefined
    },

  })

  if (isNode())
    module.exports = Dealer
  
  return Dealer
})()
