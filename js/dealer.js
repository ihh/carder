// Provide Dealer with a cardSet and a meterList

// A cardSet is one of the following:
// - an array of cards
// - an object with {when,cards} properties ('when' is auto-assigned to all cards in list)

// Card properties
//      weight: number, or callback which is passed the current gameState
//        when: if present, must be a string (or array of strings), one of which must match the last element of the gameState.stage array
//        html: string, or callback to generate content from current gameState
//   className: string
// left, right: optional objects that can contain { hint, preview, meters, stage, cb, card, sequence, cardSet }

// A 'sequence' is an array of cardSets lacking a 'when' property (it's auto-assigned). If any of the left/right objects change gameState.stage, then the sequence will be derailed.

// Meter properties are as in Carder, but the 'level' callback is passed a gameState

const Dealer = (() => {
  const Dealer = function (config) {
    let dealer = this
    let cards = config.cards, meters = config.meters || []
    $.extend (this, { cards, meters })

    // flatten nested sequences & cardSets, assign stages
    
    // return from constructor
    return this
  }

  $.extend (Dealer.prototype, {

    dealCard: function (gameState) {
      
    },

  })

  return Dealer
})()
