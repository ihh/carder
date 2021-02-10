const Carder = (() => {
  const Carder = function (config) {
    let carder = this
    config = config || {}
    $.extend (this,
              { iconPromise: {},
                svg: {},
                meters: [],
                config })
    this.container = $('<div class="carder">')
      .append (this.statbar = $('<div class="statbar">'),
               $('<div class="cardbar">')
               .html ($('<div class="cardtable">')
                      .html (this.stackDiv = $('<div class="stack">'))),
               this.makeThrowArrowContainer(),
               this.previewDiv = $('<div class="preview">'))
    this.pageContainer = $('#'+(config.parent || this.parent))
      .addClass("carder-page")
      .addClass (this.defaultTheme)
      .append ($('<div class="carder-browser-wrap">')
               .append ($('<div class="carder-top-pad">'),
                        this.container,
                        $('<div class="carder-bottom-pad">')))

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

    // listen for resize
    $(document).on ('resize', carder.resizeListener.bind(carder))
    $(window).on ('resize', carder.resizeListener.bind(carder))

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
    defaultCardClass: 'basic',
    throwOutConfidenceThreshold: .25,
    cardFadeTime: 300,
    doAnimationsOnDesktop: true,
    meterAnimFrames: 40,
    maxCardTextShrink: 4,
    maxHintTextShrink: 4,
    maxPreviewTextShrink: 4,
    
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

    browserIsSafari: function() {
      let ua = navigator.userAgent.toLowerCase()
      return ua.indexOf('safari') !== -1
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
                                   carder.leftThrowHint = $('<div class="text">'))),
                 $('<div class="arrowstripe">')
                 .html (hand.html (carder.makeIconButton ('swipe'))),
                 $('<div class="arrowstripe rightarrowstripe">')
                 .append (carder.rightThrowArrow
                          .append ($('<div class="arrow">').html (carder.makeIconButton ('swiperight', null, '#222')),
                                   carder.rightThrowHint = $('<div class="text">'))))
      return carder.throwArrowContainer
    },

    makeIconButton: function (iconName, callback, color) {
      let config = (typeof(iconName) === 'object'
                    ? iconName
                    : { iconName: iconName,
                        callback: callback,
                        color: color })
      let iconFilename = config.iconFilename || (this.iconPrefix + this.iconFilename[config.iconName] + this.iconSuffix)
      let iconNameSpan = $('<span>').addClass('iconlabel').text (config.text || config.iconName || config.iconFilename)
      let button = $('<span>').addClass('button')
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

    getIcon: function (path) {
      return $.get ({ url: path,
                      dataType: 'text' })
    },

    dealCard: function (config) {
      let carder = this
      config = config || {}
      this.currentCardConfig = $.extend ({}, config)
      let left = config.left || {}, right = config.right || {}

      carder.cardBodyDiv = $('<div class="cardbody">')
      let innerDiv = $('<div class="inner">').html ($('<div class="content">').html (config.html))
      let cardDiv = $('<div class="card">').addClass (config.className || this.defaultCardClass).html (innerDiv)
      if (carder.doAnimations())
        cardDiv.addClass ('jiggle')
      
      // hack to work around Safari centering issue
      // https://stackoverflow.com/questions/66129945/prevent-child-element-from-stretching-parent-portable-solution-for-both-chrome/66130202
      if (carder.browserIsSafari()) {
        cardDiv.css ('height', '100%')
        cardDiv.css ('min-height', '')
      }

      carder.leftThrowHint.text (left.hint || '')
      carder.rightThrowHint.text (right.hint || '')
      
      // create the swing card object for the DOM element
      let card = carder.stack.createCard (cardDiv[0])
      card.on ('throwoutleft', carder.faderCallback (cardDiv, card, left.meters, left.cb))
      card.on ('throwoutright', carder.faderCallback (cardDiv, card, right.meters, right.cb))
      card.on ('dragstart', function() {
        carder.startDrag()
      })
      card.on ('throwinend', function() {
        carder.stopDrag()
        carder.drawMeters()
      })
      card.on ('dragmove', carder.dragListener.bind (carder,
                                                     { preview: { left: left.preview || '',
                                                                  right: right.preview || '' },
                                                       meters: { left: left.meters || {},
                                                                 right: right.meters || {} } }))
      card.on ('dragend', function() {
        carder.throwArrowContainer.removeClass('dragging').addClass('throwing')
        cardDiv.removeClass('dragging').addClass('throwing')
      })

      carder.currentCardDiv = cardDiv
      
      cardDiv.hide()
      carder.stackDiv.html (cardDiv)
      cardDiv.show()

      carder.shrinkToFit (innerDiv, carder.maxCardTextShrink)
      carder.shrinkToFit (carder.leftThrowHint, carder.maxHintTextShrink)
      carder.shrinkToFit (carder.rightThrowHint, carder.maxHintTextShrink)

      carder.stopDrag()
      // throw-in effect
      if (carder.doAnimations() && !config.noThrowIn) {
        carder.startThrow (cardDiv)
        card.throwIn (0, -carder.throwYOffset())
      }
    },
    
    startThrow: function (cardDiv) {
      let carder = this
      cardDiv = cardDiv || carder.currentCardDiv
      if (carder.throwArrowContainer)
        carder.throwArrowContainer.removeClass('dragging').addClass('throwing').show()
      if (cardDiv)
        cardDiv.removeClass('dragging').addClass('throwing')
    },

    startDrag: function (cardDiv) {
      cardDiv = cardDiv || this.currentCardDiv
      this.cancelMeterAnimationFrame()
      this.animateMeters(0)
      if (this.throwArrowContainer)
        this.throwArrowContainer.removeClass('throwing').addClass('dragging').show()
      if (cardDiv)
        cardDiv.removeClass('throwing').addClass('dragging')
    },

    stopDrag: function (cardDiv) {
      let carder = this
      cardDiv = cardDiv || carder.currentCardDiv
      if (carder.throwArrowContainer)
        carder.throwArrowContainer.removeClass('throwing').removeClass('dragging').removeClass('leftdrag').removeClass('rightdrag').show()
      if (cardDiv)
        cardDiv.removeClass('throwing').removeClass('dragging')
      carder.previewDiv.empty()
    },

    dragListener: function (dragConfig, swingEvent) {
      let carder = this
      // swingEvent is a Hammer panmove event, decorated by swing
      carder.throwArrowContainer.removeClass('leftdrag').removeClass('rightdrag')
      if (swingEvent.throwDirection === swing.Direction.LEFT) {
        carder.throwArrowContainer.addClass('leftdrag')
        carder.leftThrowArrow.css ('opacity', swingEvent.throwOutConfidence)
        carder.previewDiv.html (dragConfig.preview.left)
        carder.showMeterPreviews (swingEvent.throwOutConfidence, dragConfig.meters.left)
      } else if (swingEvent.throwDirection === swing.Direction.RIGHT) {
        carder.throwArrowContainer.addClass('rightdrag')
        carder.rightThrowArrow.css ('opacity', swingEvent.throwOutConfidence)
        carder.previewDiv.html (dragConfig.preview.right)
        carder.showMeterPreviews (swingEvent.throwOutConfidence, dragConfig.meters.right)
      } else {
        carder.previewDiv.empty()
        carder.showMeterPreviews()
      }
      carder.previewDiv.css ('opacity', swingEvent.throwOutConfidence)
      carder.shrinkToFit (carder.previewDiv, carder.maxPreviewTextShrink)
    },

    showMeterPreviews: function (confidence, meterScale) {
      confidence = confidence || 0
      meterScale = meterScale || {}
      window.requestAnimationFrame (() => {
        this.meters.forEach ((meter) => {
          const scale = meterScale[meter.name]
          if (scale) {
            meter.tintDiv.removeClass('rising falling')
            meter.tintDiv.addClass(scale > 0 ? 'rising' : 'falling').css ('opacity', confidence)
          } else
            meter.tintDiv.css ('opacity', 0)
        })
      })
    },
    
    fadeCard: function (element, card) {
      let carder = this
      let fadedPromise = $.Deferred()
      element.find('*').off()
      card.destroy()
      const removeCard = function() {
	element.remove()
        fadedPromise.resolve()
      }
      if (carder.doAnimations())
        element.fadeOut (carder.cardFadeTime, removeCard)
      else
        removeCard()
      return fadedPromise
    },

    faderCallback: function (element, card, meters, cb) {
      cb = cb || this.config.defaultCallback
      return () => {
        this.showMeterPreviews (1, meters)
        let faded = this.fadeCard (element, card)
        if (cb)
          faded.then (cb)
      }
    },
    
    resizeListener: function() {
      this.drawMeters()
    },
    
    addMeter: function (config) {
      let carder = this
      let promise = this.getIconPromise (config.icon)
      return promise.then (() => {
        carder.meters.push ({ name: config.name,
                              icon: promise,
                              level: config.level || function() { return 0 } })
        carder.drawMeters()
      })
    },

    removeMeter: function (name) {
      this.meters = this.meters.filter ((meter) => meter.name !== name)
      this.drawMeters()
    },

    meterClipRect: function (meterHeight) {
      return 'rect(' + meterHeight + 'px,100vw,100vh,0)'
    },

    meterHeight: function (meter) {
      return (1 - meter.level()) * this.statbar.height()
    },
    
    drawMeters: function() {
      window.requestAnimationFrame (() => {
        let redrawNeeded = false, newDivs = []
        const height = this.statbar.height()
        const dim = { width: height + 'px',
                      height: height + 'px' }

        this.meters.reduce ((redrawn, meter) => {
          let initHeight = meter.lastHeight, targetHeight = this.meterHeight(meter), delta = targetHeight - initHeight, newHeight, tintClass = '', tint = 0
          if (typeof(initHeight) === 'undefined' || Math.abs(delta) < 1) {
            newHeight = targetHeight
            tintClass = ''
            tint = 0
          } else {
            newHeight = initHeight
            tintClass = delta < 0 ? 'rising' : 'falling'
            tint = 1
            redrawNeeded = true
          }
          let meterDiv = $('<div class="meter">'), levelDiv, tintDiv
          newDivs.push (meterDiv)
          const clipRect = this.meterClipRect (newHeight)
          return redrawn.then (() => {
            meter.icon.then ((svg) => {
              function makeMeter() {
                return $('<div class="icons">')
                  .css (dim)
                  .append ($('<div class="icon empty">').css(dim).append($(svg)),
                           levelDiv = $('<div class="icon full">').css(dim).append($(svg)).css('clip',clipRect),
                           tintDiv = $('<div class="icon tint">').addClass(tintClass).css(dim).css('opacity',tint).append($(svg)).css('clip',clipRect))
              }
              meterDiv
                .css (dim)
                .append (makeMeter())
              $.extend (meter, { div: meterDiv, levelDiv, tintDiv, lastHeight: targetHeight, initHeight, targetHeight })
            })
          })
        }, $.Deferred().resolve()).then (() => {
          this.statbar.html (newDivs)
          if (redrawNeeded)
            this.nextMeterAnimationFrame (this.meterAnimFrames)
          else
            this.meters.forEach ((meter) => meter.tintDiv.css('opacity',0))
        })
      })
    },

    cancelMeterAnimationFrame: function() {
      if (this.meterAnimFrame)
        window.cancelAnimationFrame (this.meterAnimFrame)
      delete this.meterAnimFrame
    },
    
    nextMeterAnimationFrame: function (framesLeft) {
      this.cancelMeterAnimationFrame()
      this.meterAnimFrame = window.requestAnimationFrame (() => {
        delete this.meterAnimFrame
        this.animateMeters(framesLeft)
      })
    },

    animateMeters: function (framesLeft) {
      this.meters.forEach ((meter) => {
        let { levelDiv, tintDiv, initHeight, targetHeight } = meter
        if (initHeight !== targetHeight) {
          let r = framesLeft / this.meterAnimFrames, newHeight = initHeight*r + targetHeight*(1-r), tint = r
          let clipRect = this.meterClipRect (newHeight)
          tintDiv.css ({ opacity: tint, clip: clipRect })
          levelDiv.css ('clip', clipRect)
        }
      })
      if (framesLeft > 0)
        this.nextMeterAnimationFrame (framesLeft - 1)
    },

    shrinkToFit: function (div, maxShrinkFactor) {
      let factor = 1, multiplier = 1.1
      div.css('font-size','').css('line-height','')
      const hasOverflow = () => div[0].scrollHeight > div[0].clientHeight || div[0].scrollWidth > div[0].clientWidth;
      const initFontSize = parseFloat (div.css('font-size')), initLineHeight = parseFloat (div.css('line-height'))
      while (hasOverflow() && factor < maxShrinkFactor) {
        factor = Math.min (maxShrinkFactor, factor * multiplier)
        div.css ('font-size', (initFontSize / factor) + 'px')
        div.css ('line-height', (initLineHeight / factor) + 'px')
      }
    },

  })

  return Carder
})()
