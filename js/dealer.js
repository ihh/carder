// Provide Dealer with cards, meters

// A cardSet is one of the following:
// - an array of cards
// - an object with {when,cards} properties ('when' is auto-assigned to all cards in list)

// Card properties
//      weight: number, or callback which is passed the current gameState
//        when: if present, must be a string (split into array of strings), one of which must match the last element of the gameState.stage array
//        html: string, or callback to generate content from current gameState
//   className: string
// left, right: optional swiper objects that can contain { hint, preview, meters, reward, scaledReward, stage, push, pop, cb, card, sequence, cardSet }
// limit, minTurnsAtStage, maxTurnsAtStage, minTotalTurnsAtStage, maxTotalTurnsAtStage, minTurns, maxTurns: limit when/how many times a particular card can be dealt.

// Anywhere a card can go, there can just be a string, which is assumed to be the card's html; the card has no swipers (left & right attributes).
// There can also just be a function, in which case it is evaluated (with gameState as argument) and then treated as if it were just a string.

// A 'sequence' is an array of cardSets lacking a 'when' property (it's auto-assigned). If any of the left/right objects change gameState.stage, then the sequence will be derailed.

// Meter properties are as in Carder, but the 'level' callback is passed a gameState
// Alternatively, if meter has no 'level' but has {min,max,init}, a property with the same name as the meter will be added to gameState, and its level autocomputed
// If a swiper has a 'reward' property, then this is used as a name=>delta map for the meter, and the preview auto-generated.
// 'scaledReward' is the same but auto-scales the reward so it is smaller near the top or bottom of the range.

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
      meter: {},
      anonStageCount: 0,
      gameState: extend ({
        stage: [this.startStage],
        turns: {
          byCard: {},
          byStage: [0],
          totalByStage: {},
          total: 0
        },
      }, config.gameState || {})
    })

    // flatten nested sequences & cardSets, assign stages, wrap callbacks, init turn counters
    this.flattenCardSet (cards)
    this.cards.forEach ((card, n) => {
      card.cardIndex = n
      card.left = card.left || {}
      card.right = card.right || {}
      this.makeCallbacks (card.left)
      this.makeCallbacks (card.right)
      if (typeof(card.limit) !== 'undefined')
        this.gameState.turns.byCard[n] = 0
    })

    //    console.log(JSON.stringify(this.cards,null,2))
    console.log(this.cards)
    
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
      return '!' + (++this.anonStageCount)
    },

    flattenCardSet: function (cardSet, stage) {
      if (isArray(cardSet))
        return cardSet.map ((card) => this.flattenCard (card, stage))
      if (typeof(cardSet) === 'object' && cardSet.cards && cardSet.when)
        return this.flattenCardSet (cardSet.cards, cardSet.when)
      return [this.flattenCard (cardSet, stage)]
    },

    flattenCard: function (card, stage) {
      if (typeof(card) !== 'object')
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

      return card;
    },

    flattenSwiper: function (swiper) {
      if (swiper.sequence) {
        let push = this.newAnonStage()
        swiper.push = (swiper.push || []).concat ([push])
        this.flattenSequence (swiper.sequence, push)
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
        cardSet.forEach ((card) => {
          card.left = card.left || {}
          card.right = card.right || {}
          card.left.pop = (card.left.pop || 0) + 1
          card.right.pop = (card.right.pop || 0) + 1
        })
        if (n < sequence.length - 1) {
          const next = stages[n+1]
          cardSet.forEach ((card) => {
            if (!card.left.stage)
              card.left.push = (card.left.push || []).concat ([next])
            if (!card.right.stage)
              card.right.push = (card.right.push || []).concat ([next])
          })
        }
      })
    },

    makeCallbacks: function (swiper) {
      let dealer = this
      let userCallback = swiper.cb || function(){}
      swiper.cb = () => {
        userCallback (dealer.gameState, dealer)
        if (swiper.pop) {
          let pops = typeof(swiper.pop) === 'number' ? swiper.pop : 1
          for (let n = 0; n < pops; ++n) {
            dealer.gameState.stage.pop()
            dealer.gameState.turns.byStage.pop()
          }
        }
        if (swiper.push) {
          dealer.gameState.stage = dealer.gameState.stage.concat (swiper.push)
          dealer.gameState.turns.byStage.push (0)
        }
        if (swiper.stage) {
          dealer.gameState.stage = [swiper.stage]
          dealer.gameState.turns.byStage = [0]
        }
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
      console.log(JSON.stringify({gameState}))
      let cardWeight = this.cards.map ((card) => {
        if (card.when && card.when.length && card.when.filter ((when) => when === stage).length === 0)
          return 0
        let turnsByCard = gameState.turns.byCard[card.cardIndex]
        let turnsByStage = gameState.turns.byStage[gameState.turns.byStage.length-1]
        let turnsTotalByStage = gameState.turns.totalByStage[stage]
        if ((card.limit && turnsByCard >= card.limit)
            || (card.minTurnsAtStage && turnsByStage < card.minTurnsAtStage)
            || (card.maxTurnsAtStage && turnsByStage > card.maxTurnsAtStage)
            || (card.minTotalTurnsAtStage && turnsTotalByStage < card.minTotalTurnsAtStage)
            || (card.maxTotalTurnsAtStage && turnsTotalByStage > card.maxTotalTurnsAtStage))
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
        if (template.limit)
          ++gameState.turns.byCard[template.cardIndex]
        ++gameState.turns.byStage[gameState.turns.byStage.length - 1]
        gameState.turns.totalByStage[stage] = (gameState.turns.totalByStage[stage] || 0) + 1
        gameState.turns.total++
        
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
      if (template.reward || template.scaledReward) {
        swiper.meters = {}
        meterDelta = {}
        this.setDeltas (meterDelta, swiper.meters, template.reward, false)
        this.setDeltas (meterDelta, swiper.meters, template.scaledReward, true)
      }
      if (template.cb || meterDelta)
        swiper.cb = () => {
          if (meterDelta)
            Object.keys(meterDelta).forEach ((name) => {
              this.gameState[name] += meterDelta[name]
            })
          if (template.cb)
            template.cb()
        }
      return swiper
    },

    setDeltas: function (meterDelta, swiperMeters, reward, scaled) {
      if (reward)
        Object.keys(reward).forEach ((name) => {
          const delta = this.evalNumber (reward[name])
          const meter = this.meter[name], oldLevel = this.gameState[name]
          const scaledDelta = (scaled
                               ? ((delta > 0
                                   ? (meter.max - oldLevel)
                                   : (oldLevel - meter.min))
                                  * delta / (meter.max - meter.min))
                               : delta)  // c.f. https://choicescriptdev.fandom.com/wiki/Arithmetic_operators
          if (scaledDelta) {
            meterDelta[name] = scaledDelta
            swiperMeters[name] = Math.sign(scaledDelta)
        }
        })
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
