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
  const Dealer = function (config) {
    let dealer = this
    let carder = config.carder || new Carder ({ parent: config.parent }),
        cards = config.cards,
        meters = config.meters || []
    $.extend (this, {
      carder,
      cards: [],
      anonStageCount: 0,
      gameState: $.extend ({
        stage: [this.startStage]
      }, config.gameState || {})
    })

    // flatten nested sequences & cardSets, assign stages, wrap callbacks
    this.flattenCardSet (cards)
    this.cards.forEach ((card) => {
      if (card.left)
        this.wrapCallbacks (card.left)
      if (card.right)
        this.wrapCallbacks (card.right)
    })

    // create meters
    meters.forEach ((meter) =>
      carder.addMeter ({ name: meter.name,
                         icon: meter.icon,
                         level: () => meter.level (dealer.gameState) }))
    
    // return from constructor
    return this
  }

  $.extend (Dealer.prototype, {
    // config
    startStage: 'start',
    
    // methods
    newAnonStage: function() {
      return '!' + (this.anonStageCount++)
    },
    
    flattenCardSet: function (cardSet, stage) {
      if ($.isArray(cardSet)) {
        cardSet.forEach ((card) => this.flattenCard (card, stage))
        return cardSet
      }
      return this.flattenCardSet (cardSet.cards, cardSet.when)
    },

    flattenCard: function (card, stage) {
      card.when = (card.when || stage).split(/\s+/)
      if (card.next)
        card.left = card.right = card.next
      this.flatten.append (card)
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

    wrapCallbacks: function (swiper) {
      let dealer = this
      let userCallback = swiper.cb || function(){}
      swiper.cb = () => {
        userCallback (dealer.gameState, dealer)
        // TODO: smart update of meters (automatic hints)
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
      return this.gameState.stage[this.gameState.stage.length - 1]
    },
    
    nextCard: function() {
      let dealer = this
      let current = this.currentStage(), state = this.gameState
      let cardWeight = this.cards.map ((card) => {
        if (card.when && card.when.length && card.when.filter ((when) => when === state).length === 0)
          return 0
        let w = card.weight
        if (typeof(w) === 'undefined')
          return 1
        if (typeof(w) === 'function')
          w = w (gameState, dealer)
        return typeof(w) === 'number' ? w : 0
      })
      carder.dealCard (this.cards[this.sampleByWeight (cardWeight)])
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

  return Dealer
})()
