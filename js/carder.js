const Carder = (() => {
  const Carder = function (config) {
    let carder = this
    config = config || {}
    $.extend (this,
              { iconPromise: {},
                svg: {} })
    this.container = $('<div class="carder">')
      .addClass (this.defaultTheme)
      .append (this.statbar = $('<div class="statbar">'),
               this.stackDiv = $('<div class="stack">'),
               this.makeThrowArrowContainer())
    this.pageContainer = $('#'+(config.parent || this.parent))
      .addClass("carder-page")
      .append ($('<div class="carder-browser-wrap">')
               .append (this.container,
                        $('<div class="carder-browser-statbar-pad">')))

    // prevent scrolling/viewport bump on iOS Safari
    document.addEventListener ('touchmove', function(e){
      e.preventDefault()
    }, {passive: false})

    // initialize the swing Stack
    this.stack = swing.Stack ({ throwOutConfidence: carder.throwOutConfidence,
			        throwOutDistance: function() { return carder.throwXOffset() },
			        allowedDirections: [
				  swing.Direction.LEFT,
				  swing.Direction.RIGHT
			        ],
                                isThrowOut: carder.isThrowOut.bind(carder) })

    
    // test
    this.dealCard()
    
    // return from constructor
    return this
  }

  $.extend (Carder.prototype, {
    // configuration
    parent: 'carder',
    defaultTheme: 'plain',
    iconPrefix: 'img/',
    iconSuffix: '.svg',
    iconFilename: { swipe: 'one-finger-contact-swipe',
                    swipeleft: 'left-swipe-arrow',
                    swiperight: 'right-swipe-arrow' },
    throwOutConfidenceThreshold: .25,
    doAnimationsOnDesktop: true,
    
    // helpers
    isTouchDevice: function() {
      return 'ontouchstart' in document.documentElement
    },

    doAnimations: function() {
      return this.doAnimationsOnDesktop || this.isTouchDevice()
    },
    
    throwXOffset: function() {
      return this.container.width() * 2 / 3
    },

    throwYOffset: function() {
      return this.container.height() / 4
    },

    throwOutConfidence: function (xOffset, yOffset, element) {
      return Math.min (Math.max (Math.abs(xOffset) / element.offsetWidth, Math.abs(yOffset) / element.offsetHeight), 1)
    },

    inPortraitMode: function() {
      return window.innerHeight > window.innerWidth
    },

    isThrowOut: function (xOffset, yOffset, element, throwOutConfidence) {
      return throwOutConfidence > this.throwOutConfidenceThreshold
    },

    // builders
    makeThrowArrowContainer: function (config) {
      let carder = this
      config = config || {}
      carder.leftThrowArrow = $('<div class="arrowplustext">')
      carder.rightThrowArrow = $('<div class="arrowplustext">')
      let hand = $('<div class="hand">')
      carder.throwArrowContainer = $('<div class="arrowcontainer">')
        .append ($('<div class="arrowstripe leftarrowstripe">')
                 .append (carder.leftThrowArrow
                          .append ($('<div class="arrow">').html (carder.makeIconButton ('swipeleft', null, '#222')),
                                   $('<div class="text">').text (config.leftText || ''))),
                 $('<div class="arrowstripe">')
                 .html (hand.html (carder.makeIconButton ('swipe'))),
                 $('<div class="arrowstripe rightarrowstripe">')
                 .append (carder.rightThrowArrow
                          .append ($('<div class="arrow">').html (carder.makeIconButton ('swiperight', null, '#222')),
                                   $('<div class="text">').text (config.rightText || ''))))
      return carder.throwArrowContainer
    },

    makeIconButton: function (iconName, callback, color) {
      let config = (typeof(iconName) === 'object'
                    ? iconName
                    : { iconName: iconName,
                        callback: callback,
                        color: color })
      let iconFilename = config.iconFilename || this.iconFilename[config.iconName]
      let iconNameSpan = $('<span>').addClass('iconlabel').text (config.text || config.iconName || config.iconFilename)
      let button = $('<span>').addClass('button').html (iconNameSpan)
      this.getIconPromise (iconFilename)
        .done (function (svg) {
          let elem = $(svg)
          if (config.color)
            elem.css ('fill', config.color)
          button.prepend (elem)
        })
      if (config.callback)
        button.on ('click', config.callback)
      return button
    },

    getIconPromise: function (icon) {
      if (!this.iconPromise[icon])
        this.iconPromise[icon] = this.svg[icon] ? $.Deferred().resolve(this.svg[icon]) : this.getIcon (icon)
      return this.iconPromise[icon]
    },

    getIcon: function (icon) {
      return $.get ({ url: this.iconPrefix + icon + this.iconSuffix,
                      dataType: 'text' })
    },

    dealCard: function (config) {
      let carder = this
      config = config || {}
      carder.messageBodyDiv = $('<div class="messagebody">')
      let choiceTextDiv = $('<div class="choicetext">')
      let innerDiv = $('<div class="inner">').append (carder.messageBodyDiv, choiceTextDiv)
      let cardDiv = $('<div class="card">').append (innerDiv)
      if (carder.doAnimations())
        cardDiv.addClass ('jiggle')  // non-touch devices don't get the drag-start event that are required to disable jiggle during drag (jiggle is incompatible with drag), so we just don't jiggle on non-touch devices for now

      // create the swing card object for the compose card
      let card = carder.stack.createCard (cardDiv[0]), reject
      card.on ('throwoutleft', carder.dealCard.bind (carder))
      card.on ('throwoutright', carder.dealCard.bind (carder))
      card.on ('dragstart', function() {
        carder.startDrag()
      })
      card.on ('throwinend', function() {
        carder.stopDrag()
      })
      card.on ('dragmove', carder.dragListener.bind (carder, true))
      card.on ('dragend', function() {
        carder.throwArrowContainer.removeClass('dragging').addClass('throwing')
        cardDiv.removeClass('dragging').addClass('throwing')
      })

      carder.currentCardDiv = cardDiv
      
      cardDiv.hide()
      let stackReadyPromise = config.stackReady || $.Deferred().resolve()
      return stackReadyPromise
	.then (function() {
          carder.stackDiv.html (cardDiv)
          cardDiv.show()
          carder.stopDrag()
	  // throw-in effect
	  if (carder.doAnimations() && !config.noThrowIn) {
            carder.startThrow (cardDiv)
            card.throwIn (0, -carder.throwYOffset())
          }
          if (carder.nextDealPromise)
            carder.nextDealPromise.resolve()
          carder.nextDealPromise = $.Deferred()
          return cardDiv
        })
    },
    
    startThrow: function (cardDiv) {
      var carder = this
      cardDiv = cardDiv || carder.currentCardDiv
      if (carder.throwArrowContainer)
        carder.throwArrowContainer.removeClass('dragging').addClass('throwing').show()
      if (cardDiv)
        cardDiv.removeClass('dragging').addClass('throwing')
    },

    startDrag: function (cardDiv) {
      var carder = this
      cardDiv = cardDiv || carder.currentCardDiv
      if (carder.throwArrowContainer)
        carder.throwArrowContainer.removeClass('throwing').addClass('dragging').show()
      if (cardDiv)
        cardDiv.removeClass('throwing').addClass('dragging')
    },

    stopDrag: function (cardDiv) {
      var carder = this
      cardDiv = cardDiv || carder.currentCardDiv
      if (carder.throwArrowContainer)
        carder.throwArrowContainer.removeClass('throwing').removeClass('dragging').removeClass('leftdrag').removeClass('rightdrag').show()
      if (cardDiv)
        cardDiv.removeClass('throwing').removeClass('dragging')
    },

    dragListener: function (showPreview, swingEvent) {
      let carder = this
      // swingEvent is a Hammer panmove event, decorated by swing
      carder.throwArrowContainer.removeClass('leftdrag').removeClass('rightdrag')
      if (swingEvent.throwDirection === swing.Direction.LEFT) {
        carder.throwArrowContainer.addClass('leftdrag')
        carder.leftThrowArrow.css ('opacity', swingEvent.throwOutConfidence)
      } else if (swingEvent.throwDirection === swing.Direction.RIGHT) {
        carder.throwArrowContainer.addClass('rightdrag')
        carder.rightThrowArrow.css ('opacity', swingEvent.throwOutConfidence)
      } else
        previewComposition = carder.composition
      if (showPreview) {
        let previewDirection = (swingEvent.throwOutConfidence > carder.previewConfidenceThreshold
                                ? swingEvent.throwDirection
                                : undefined)
        if (carder.lastPreviewDirection !== previewDirection) {
          let previewClass
          if (previewDirection === swing.Direction.LEFT
              || (carder.standalone &&
                  (previewDirection === swing.Direction.DOWN
                   || previewDirection === swing.Direction.UP))) {
            previewClass = 'reject'
          } else if (previewDirection === swing.Direction.RIGHT) {
            previewClass = 'accept'
          } else {
            previewClass = 'unknown'
          }
          carder.messageBodyDiv.find('.preview').hide()
          carder.messageBodyDiv.find('.preview-' + previewClass).show()
          carder.lastPreviewDirection = previewDirection
        }
      }
    },

  })

  return Carder
})()
