/*
* SmartColumnScroller ver. 0.21 (17 January 2011)
* @requires jQuery v1.4 or later
*
* Copyright 2011 Dusan Hlavaty [ dhlavaty@gmail.com ]
*
* In multicolumn page layout, automatically scrolls smaller column
* so user never sees white space underneath. 
*
* Licensed under the MIT:
* http://www.opensource.org/licenses/mit-license.php
* You are free to use a SmartColumnScroller in commercial projects as long
* as the copyright header is left intact.
*
* Usage:
*
* jQuery(window).load(function () { 
*   jQuery('#myDiv').smartColumnScroller();
* });
*
* Recommendation: start plugin processing in 'window.load' event and not in 'document.ready'
*
*/
	(function( $ )
	{
		$.fn.smartColumnScroller = function()
		{
			// there's no need to do $(this) because
			// "this" is already a jquery object

			// for each element:
			return this.each(function()
			{
				// tomuto moc nerozumiem (zatial), ale raz pochopim ;-)
				var $this = $(this);

				// remembering original 'top' of column
				$this.data('scs-top', $this.offset().top );
				
				// remembering original 'left' of column
				$this.data('scs-left',  parseInt($this.offset().left, 10) - parseInt($this.css('margin-left'), 10));
				
				// remembering height of parent (scrolling will occur in this space)
				$this.data('scs-parent-height', $this.parent().height() );
				
				// hook on 'scroll' event
				$(window).scroll( function()
				{
					try
					{
						// prepare some local variables, so that we dont compute them unnecessarily more than once:
						
						// compute height of column. Will compute it after every scroll event because column may have changed...
						// ...(for example by another javascript on this page)
						var jQueryColumnHeight = $this.height();
						
						// get height of parent
						var jQueryColumnParentHeight = parseInt($this.data('scs-parent-height'), 10);

						// if height of column is higher or equal than parent, there is nothing to scroll...
						if ( jQueryColumnHeight >= jQueryColumnParentHeight )
						{
							// ...so we exit
							return;
						}
						
						// prepare some more local variables, so that we dont compute them unnecessarily more than once:
						
						// get original 'top' position of column
						var jQueryColumnOriginalTop = parseInt($this.data('scs-top'), 10);
						// calculate height of browsers viewport (Will compute it after every scroll event because user may have changed it)
						var browserWindowHeight = $(window).height();
						// get scrollTop position
						var browserScrollTop = $(document).scrollTop();
						
						// If user scrolled all the way down and column can no longer scroll (because touched its bottom),
						// switch column to 'static' and add correct 'margin-top'
						if (( jQueryColumnParentHeight + jQueryColumnOriginalTop - browserWindowHeight - browserScrollTop) <= 0)
						{
							// if we already are in 'static mode', dont do anything
							if ($this.css('position') != 'static') // TODO: change to .data('phase','3')
							{
								// set to 'static'
								$this.css({'position':'static', 'margin-top':jQueryColumnParentHeight - jQueryColumnHeight});
							}
							
							// remembering original 'left' of column
							$this.data('scs-left',  parseInt($this.offset().left, 10) - parseInt($this.css('margin-left'), 10));
							
							// and exit
							return;
						}
						
						// If user scrolled down and column can start to 'scroll' (because the white space would appear),
						// switch column to 'fixed' and set correct 'top' and 'left' position
						if ((jQueryColumnHeight + jQueryColumnOriginalTop - browserWindowHeight - browserScrollTop) <= 0)
						{ 
							// if we already are in 'fixed mode', dont do anything
							if ($this.css('position') != 'fixed') // TODO: change to .data('phase','2')
							{
								// calculate correct 'top' position of column
								var topPos = browserWindowHeight - jQueryColumnHeight;
								// calculate correct 'left' position of column
								var leftPos = $this.data('scs-left');

								// set to 'fixed'
								$this.css({'position':'fixed', 'margin-top':0, 'top': topPos, 'left':leftPos});
							}
						} else {
							// If user scrolled down, so that column dont have to 'scroll' yet (because the user has not seen it entire),
							// switch column to 'static' and reset 'margin-top'

							// if we already are in 'static mode', dont do anything
							if ($this.css('position') != 'static') // TODO: change to .data('phase','1')
							{
								// set to 'static' and reset 'margin-top'
								$this.css({'position':'static', 'margin-top':0});
							}
							
							// remembering original 'left' of column
							$this.data('scs-left',  parseInt($this.offset().left, 10) - parseInt($this.css('margin-left'), 10));
						}
						
					}
					catch (exception)
					{
						// in case of any error, reset column behavior
						$this.css({'position':'static', 'margin-top':0});
					}
				
				}); // END: scroll( function()
				
				
			}); // END: this.each(function()

			
		}; /* END: $.fn.smartColumnScroller = function()  */
	})( jQuery );