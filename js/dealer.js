// A 'cardSet' is an array of cards or staged cardSets, representing a collection of cards.
// A 'sequence' is an array of cardSets lacking a 'when' property (it's auto-assigned). If any of the left/right objects change gameState.stage, then the sequence will be derailed.

// Anywhere a cardSet or sequence can appear, there can alternatively be an object with a 'cards' property (that is an array), and any subset of the card properties listed below.
// These properties are then inherited by all the cards in the 'cards' list.

// Card properties include
//      weight: number, or callback which is passed the current gameState
//    priority: zero by default. Only cards with the highest priority and nonzero weight are eligible to be dealt
//        when: if present, must be a string (split into array of strings), one of which must match the last element of the gameState.stage array
//        html: string, or callback to generate content from current gameState
//    cssClass: string
// left, right: optional swiper objects that can contain { hint, preview, meters, reward, scaledReward, stage, push, pop, cb, card, sequence, cardSet }
// limit, minTurnsAtStage, maxTurnsAtStage, minTotalTurnsAtStage, maxTotalTurnsAtStage, minTurns, maxTurns: limit when/how many times a particular card can be dealt.
//        cool: cooling-off period i.e. number of cards dealt *from the same stage* before the card can be dealt again

// Anywhere a card can go, there can just be a string, which is assumed to be the card's html; the card has no swipers (left & right attributes).
// There can also just be a function, in which case it is evaluated (with gameState as argument) and then treated as if it were just a string.

// Meter properties are as in Carder, but the 'level' callback is passed a gameState
// Alternatively, if meter has no 'level' but has {min,max,init}, a property with the same name as the meter will be added to gameState, and its level autocomputed
// If a swiper has a 'reward' property, then this is used as a name=>delta map for the meter, and the preview auto-generated.
// 'scaledReward' is the same but auto-scales the reward so it is smaller near the top or bottom of the range.

const Dealer = (() => {

  // helpers
  function isArray(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]'
  }

  function extend() {
    const args = Array.from (arguments)
    let dest = args[0], src = args[1]
    Object.keys(src).forEach ((key) => dest[key] = src[key])
    if (args.length > 2)
      return extend.apply (null, [dest].concat (args.slice(2)))
    return dest
  }

  const deepCopy = (inObject) => {
    let outObject, value, key
    if (typeof inObject !== "object" || inObject === null)
      return inObject
    outObject = Array.isArray(inObject) ? [] : {}
    for (key in inObject) {
      value = inObject[key]
      outObject[key] = deepCopy(value)
    }
    return outObject
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

    this.initGameState = this.makeInitGameState (config.gameState)
    this.localStorage = config.localStorage || (isBrowser() && eval('window.localStorage'))
    this.localStorageKey = config.localStorageKey || this.defaultLocalStorageKey
    extend (this, {
      carder,
      cards: [],
      meter: {},
      anonStageCount: 0,
      meterIconPrefix: config.meterIconPrefix || this.defaultIconPathPrefix,
      debug: config.debug
    })
    
    // create meters
    this.initialized = meters.reduce ((promise, meter, n) => {
      return promise.then (() => {
        if (!meter.iconName)
          meter.icon = this.meterIconPrefix + meter.name + this.defaultIconPathSuffix
        if (meter.level)
          return carder.addMeter ({ name: meter.name,
                                    icon: meter.icon,
                                    level: () => meter.level (this.gameState) },
                                  true)
        else {
          this.meter[meter.name] = meter
          if (typeof(meter.min) === 'undefined' && typeof(meter.max) === 'undefined')
            extend (meter, { min: 0, max: 1 })
          if (typeof(meter.min) === 'undefined' && meter.max > 0)
            meter.min = 0
          if (typeof(this.initGameState[meter.name]) === 'undefined')
            this.initGameState[meter.name] = typeof(meter.init) === 'undefined' ? ((meter.max + meter.min) / 2) : meter.init
          return carder.addMeter ({ name: meter.name,
                                    icon: meter.icon,
                                    level: () => Math.min (1, Math.max (0, (this.gameState[meter.name] - meter.min) / (meter.max - meter.min))) },
                                  true)
        }
      })
    }, $.Deferred().resolve())
      .then (() => {

        // flatten nested sequences & cardSets, assign stages, wrap callbacks, init turn counters
        this.flattenCardSet (cards, {})
        this.cards.forEach ((card, n) => {
          card.cardIndex = n
          card.left = card.left || {}
          card.right = card.right || {}
          this.makeCallbacks (card.left)
          this.makeCallbacks (card.right)
          if (typeof(card.limit) !== 'undefined')
            this.initGameState._.turns.byCard[n] = 0
        })
        
        if (this.debug)
          console.log (this.cards)

        // set initial game state
        this.gameState = this.storedGameState() || deepCopy (this.initGameState)
        carder.drawMeters()
        
        // set status message
        if (config.status)
          carder.setStatus (() => config.status (this.gameState, this))

        // set reset callback
        carder.setRestart (() => {
          this.deleteStoredGame()
          this.gameState = deepCopy (this.initGameState)
          carder.reset()
          this.dealFirstCard()
        }, config.resetText, config.resetConfirmText)
      })

    // return from constructor
    return this
  }

  extend (Dealer.prototype, {
    // configuration
    startStage: 'start',
    defaultIconPathPrefix: 'img/',
    defaultIconPathSuffix: '.svg',
    defaultLocalStorageKey: 'Carder.Dealer',
    
    // methods
    storedGame: function() {
      let g
      try {
        let store = this.localStorage && this.localStorage.getItem (this.localStorageKey)
        g = store && JSON.parse (store)
      } catch (e) {
        this.deleteStoredGame()
      }
      return g
    },

    storedGameState: function() {
      let store = this.storedGame()
      return store && store.gameState
    },

    deleteStoredGame: function() {
      if (this.localStorage)
        this.localStorage.removeItem (this.localStorageKey)
    },
    
    makeInitGameState: function (templateInitGameState) {
      return extend ({
        _: {
          stage: [this.startStage],
          turns: {
            byCard: {},
            byStage: [0],
            totalByStage: {},
            total: 0
          },
          history: {
            byStage: [[]],
          },
        }
      }, templateInitGameState || {})
    },
    
    newAnonStage: function() {
      return '!' + (++this.anonStageCount)
    },

    cardProps: ['weight','priority','when','html','cssClass','left','right','limit','minTurnsAtStage','maxTurnsAtStage','minTotalTurnsAtStage','maxTotalTurnsAtStage','minTurns','maxTurns','cool'],
    
    overrideProps: function (obj, props) {
      let newProps = extend ({}, props)
      this.cardProps.forEach ((prop) => {
        if (obj.hasOwnProperty (prop))
          newProps[prop] = obj[prop]
      })
      return newProps
    },

    flattenCardSet: function (cardSet, props) {
      if (isArray(cardSet))
        return cardSet.reduce ((list, card) => list.concat (this.flattenCardSet (card, props)), [])
      if (typeof(cardSet) === 'object' && cardSet.cards)
        return this.flattenCardSet (cardSet.cards, this.overrideProps (cardSet, props))
      return [this.flattenCard (cardSet, props)]
    },

    flattenCard: function (card, props) {
      if (typeof(card) !== 'object')
        card = { html: this.evalString (card) }
      
      let when = card.when || props.when
      card.when = when ? (isArray(when) ? when : when.split(/\s+/)) : undefined
      Object.keys(props).filter ((prop) => !card.hasOwnProperty(prop)).forEach ((prop) => card[prop] = props[prop])
      if (card.next && !card.left)
        card.left = card.next
      if (card.next && !card.right)
        card.right = card.next
      this.cards.push (card)
      if (card.left)
        this.flattenSwiper (card.left, props)
      if (card.right && card.right !== card.left)
        this.flattenSwiper (card.right, props)

      return card;
    },

    flattenSwiper: function (swiper, props) {
      if (swiper.sequence) {
        let push = this.newAnonStage()
        swiper.push = (swiper.push || []).concat ([push])
        this.flattenSequence (swiper.sequence, extend ({}, props, { when: push }))
      } else if (swiper.card) {
        swiper.stage = this.newAnonStage()
        this.flattenCard (swiper.card, extend ({}, props, { when: swiper.stage }))
      } else if (swiper.cardSet) {
        swiper.stage = this.newAnonStage()
        this.flattenCardSet (swiper.cardSet, extend ({}, props, { when: swiper.stage }))
      }
    },

    flattenSequence: function (sequence, props) {
      if (!isArray(sequence) && typeof(sequence) === 'object' && sequence.cards)
        return this.flattenSequence (sequence.cards, this.overrideProps (sequence, props))
      let stages = [], cardSets = []
      sequence.forEach ((cardSet, n) => {
        cardSets.push (this.flattenCardSet (cardSet, props))
        stages.push (props.when)
        if (n !== sequence.length - 1) {
          let stage = this.newAnonStage()
          props = extend ({}, props, { when: stage })
        }
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
        let gs = dealer.gameState._
        userCallback (dealer.gameState, dealer)
        if (swiper.pop) {
          let pops = typeof(swiper.pop) === 'number' ? swiper.pop : 1
          for (let n = 0; n < pops; ++n) {
            gs.stage.pop()
            gs.turns.byStage.pop()
            gs.history.byStage.pop()
          }
        }
        if (swiper.push) {
          gs.stage = gs.stage.concat (swiper.push)
          gs.turns.byStage.push (0)
          gs.history.byStage.push ([])
        }
        if (swiper.stage) {
          gs.stage = [swiper.stage]
          gs.turns.byStage = [0]
          gs.history.byStage = [[]]
        }
        dealer.nextCard()
      }
    },
    
    currentStage: function() {
      let gs = this.gameState._
      return gs.stage.length > 0 ? gs.stage[gs.stage.length - 1] : undefined
    },

    dealFirstCard: function() {
      this.initialized.then (() => {
        let g = this.storedGame()
        if (g)
          this.carder.dealCard (this.makeCard (this.cards[g.cardIndex],
                                               g.cardHtml))
        else
          this.nextCard()
      })
    },

    nextCard: function() {
      let dealer = this
      let stage = this.currentStage(), gameState = this.gameState, gs = gameState._
      console.log()
      console.log(JSON.stringify({gameState}))

      // Use the weight, turn limit, cool-off, and/or priority rules to arrive at a weight distribution over cards
      // Weights & turn limits
      let cardWeight = this.cards.map ((card) => {
        if (card.when && card.when.length && card.when.filter ((when) => when === stage).length === 0)
          return 0
        let turnsByCard = gs.turns.byCard[card.cardIndex]
        let turnsByStage = gs.turns.byStage[gs.turns.byStage.length-1]
        let turnsTotalByStage = gs.turns.totalByStage[stage]
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
        return typeof(w) === 'number' ? Math.max(w,0) : 0
      })
      // Cool-off
      let history = gs.history.byStage[gs.history.byStage.length - 1]
      let turnsSinceCool = this.cards.map ((card, n) => {
        let tsc
        if (cardWeight[n] > 0) {
          tsc = history.length
          if (card.cool) {
            let last = history.lastIndexOf(card.cardIndex)
            if (last >= 0)
              tsc = history.length - last - (card.cool || 0)
          }
          return tsc
        }
      })
      let maxTurnsSinceCool = Math.max.apply (Math, turnsSinceCool.filter ((x) => typeof(x) !== 'undefined'))
      cardWeight = cardWeight.map ((w, n) => (turnsSinceCool[n] > 0 || turnsSinceCool[n] === maxTurnsSinceCool) ? w : 0)
      // Priority
      let maxPriority = this.cards.reduce ((mp, card, n) => {
        let priority = card.priority || 0
        if (cardWeight[n] > 0 && (typeof(mp) === 'undefined' || priority > mp))
          mp = priority
        return mp
      }, undefined)
      cardWeight = cardWeight.map ((w, n) => (this.cards[n].priority || 0) === maxPriority ? w : 0)
                                                 
      const template = this.cards[this.sampleByWeight (cardWeight)]
      if (typeof(template) !== 'undefined') {
        if (template.limit)
          ++gs.turns.byCard[template.cardIndex]
        ++gs.turns.byStage[gs.turns.byStage.length - 1]
        gs.turns.totalByStage[stage] = (gs.turns.totalByStage[stage] || 0) + 1
        gs.turns.total++
        gs.history.byStage[gs.history.byStage.length - 1].push (template.cardIndex)
        
        let card = this.makeCard (template)
        this.carder.dealCard (card)
        if (this.localStorage)
          this.localStorage.setItem (this.localStorageKey,
                                     JSON.stringify ({ gameState: this.gameState,
                                                       cardIndex: template.cardIndex,
                                                       cardHtml: card.html }))
      }
    },
    
    makeCard: function (template, html) {
      html = html || this.evalString (template.html)
      return {
        html,
        cssClass: template.cssClass,
        left: this.evalSwiper (template.left),
        right: this.evalSwiper (template.right),
        cardIndex: template.cardIndex   // not used by Carder, but used by FakeCarder for debugging
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
                     preview: this.evalString (template.preview || template.hint) }
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
