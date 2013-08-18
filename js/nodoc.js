
var DocumentationViewer = (function($, undefined) { 
	
return function(settings) {
	settings = settings || {};

	var base_folder = settings.base_folder || '';
	if (base_folder && base_folder[base_folder.length-1] !== '/') {
		base_folder = base_folder + '/';
	}

	var fade_speed_multiplier = settings.fade_speed_multiplier || 1.0;


	var fetch_infoset = (function() {

		var infoset_cache_waiters = {};
		var infoset_cache = {};

		// mini ajax fetcher for infosets with caching
		return function(what, callback) {
			if(infoset_cache[what]) {
				callback(infoset_cache[what]);
				return;
			}

			if(infoset_cache_waiters[what]) {
				infoset_cache_waiters[what].push(callback);
				return;
			}

			infoset_cache_waiters[what] = [callback];

			var ajax;
			if (window.XMLHttpRequest) {
		  		ajax = new XMLHttpRequest();
			}
			else {
		  		ajax = new ActiveXObject("Microsoft.XMLHTTP");
			}

			ajax.onreadystatechange = function() {
				if (ajax.readyState === 4) {
					var infoset = null;
					if(ajax.status === 200) {
						infoset = JSON.parse(ajax.responseText);
					}
					infoset_cache[what] = infoset;
					var waiters = infoset_cache_waiters[what];
					for (var i = 0; i < waiters.length; ++i) {
						waiters[i](infoset);
					}
				}
			}

			ajax.open("GET", base_folder + what + "?nocache=" + new Date().getTime(),true);
			ajax.send(null);
		};
	}) ();


	var method_full_template = _.template(
		'<div class="method" id="<%= link_info %>"> ' +
			'<div class="method_info <%= access_spec %>"> </div> ' +
			'<div class="method_info <%= extra_spec %>"> </div> ' +
			'<h3> '+
				'<font size="-1"> ' +
					'<%= access_spec %> ' +
					'<%= extra_spec %>  ' +
					'<%= return_type %> ' +
				'</font> ' +
				'<%= name %>  ' +
				'(<%= parameters %>) '+
			'</h3>  ' +
			'<%= comment %> <hr> '+
		'</div>');

	var class_template = _.template(
		'<h1> ' +
			'<font size="-1">' + 
				'<%= access_prefix %> <%= extra_prefix %> <%= type %> '+
			'</font> '+
			'<%= name %> '+
		'</h1> '+
		'<%= long_desc %>');

	var method_index_entry_template = _.template(
		'<li> '+
			'<a href="<%= link_info %>"> '+
				'<%= name %> (<%= parameters %>) '+
			'</a>'+
		'</li>');

	var ctor_index_entry_template = _.template(
		'<li>'+
			'<a href="">'+
				'&diam; <%= name %> (<%= parameters %>) '+
			'</a>'+
		'</li>');

	var method_index_template = _.template('<hr>'+
		'<div class="index">'+
			'<ul>'+
				'<%= index %>'+
			'</ul>'+
		'</div>');

	var loading_template = _.template('<div class="loading"> <%= text %> </div>');


	var index_entry_java_class_template = _.template(
		'<li class="search_entry_java_class">' + 
			'<span class="class_name">' +
				'<%= name %>' +
			'</span>' +
			'<span class="class_package">' +
				'<%= package %>' +
			'</span>' +
			'<span class="class_brief">' +
				'<%= brief %>' +
			'</span>' +
		'</li>');

	// namespace for User-Interface utilities
	var ui = this.ui = (function() {

		// ----------------------------------------------------------------------------------------
		/** Represents a UI plane that can be dynamically filled with content */
		// ----------------------------------------------------------------------------------------
		function ViewPlane(str_selector) {

			var successor = null;
			var page_stack = [];

			this.set = function(contents, settings) {

				if(_.isString(contents)) {
					contents = $(contents);
				}

				var new_successor = $.extend( {
					contents : contents,
				}, settings );

				// if we are already fading to another page, just keep that
				// transition but make it transit to the new "next" page.
				if (successor !== null) {
					successor = new_successor;
					return;
				}

				var $elem = $(str_selector);
				var duration = 200 * fade_speed_multiplier;

				successor = new_successor;

				var commit = function() {
					$elem.empty();
					$elem.append(successor.contents);

					var successor_copy = successor;
					if (!successor_copy.no_scrollbars) {
						$elem.mCustomScrollbar({
						  	theme: "dark-thick"
						  	, mouseWheelPixels: 600 
							, scrollButtons: {
      							  enable: true
    						}
						});
					}

					var commit = function() {
						$elem.mCustomScrollbar("update");

						// TODO: do async and narrow down focus
						prettyPrint();
					};

					if(successor.no_fade) {
						commit();
					}
					else {
						$elem.fadeIn(duration, commit);
					}
					successor = null;
				};

				if (successor.no_fade) {
					commit();
				}
				else {
					$elem.fadeOut(duration, commit);
				}
			};

			this.push = function(contents, settings) {
				this.set(contents, settings);
				page_stack.push([$(str_selector).clone(true)]);
			};

			this.pop = function(settings) {
				page_stack.pop();
				var elem = page_stack[page_stack.length - 1];
				$(str_selector).replaceWith(elem);
			};

			this.scrollTo = function(selector, settings) {
				// have to get the ID because scrollTo does not accept arbitrary jQuery selectors
				var el_id = '#' + $(selector).first().attr('id');
				$(str_selector).mCustomScrollbar("scrollTo",el_id, settings);
			}
		};


		// ----------------------------------------------------------------------------------------
		/** Manages the standard view plane layout, which has a view plane on
		 *  the left and one on the right.  */
		 // ----------------------------------------------------------------------------------------
		function ViewPlaneManager() {
		
			var _left = new ViewPlane(".left");
			var _right = new ViewPlane(".right");

			this.left = function() {
				return _left;
			};

			this.right = function() {
				return _right;
			};

			this.set = function(left, right, settings) {
				if(left !== null) {
					_left.set(left, settings);
				}
				if(right !== null) {
					_right.set(right, settings);
				}
			};

			this.push = function(left, right, settings) {
				_left.push(left, settings);
				_right.push(right, settings);
			};


			this.pop = function(settings) {
				_left.pop(settings);
				_right.pop(settings);
			};
		};

		return {
			  ViewPlaneManager : ViewPlaneManager
			, ViewPlane : ViewPlane
		};
	})();


	var view_planes = new ui.ViewPlaneManager();


	// namespace for Controller components - mostly actions for different kinds of UI entities
	var controller = this.controller = (function() {

		// ----------------------------------------------------------------------------------------
		/**  */
		// ----------------------------------------------------------------------------------------
		function ClassController(infoset) {

			this.select_method = function(view_plane_manager, target) {
				// resolve the link
				var link = $('#' + target);
				if(link.length === 0) {
					// ignore, but maybe log (TODO)
					return;
				}
				view_plane_manager.right().scrollTo(link, {
					scrollInertia : 105
				});
			}
		};

		return {
			ClassController : ClassController
		};
	})();


	// namespace for View components - mostly renderers for different types of Java entities
	var view = this.view = (function() {

		// ----------------------------------------------------------------------------------------
		/** Generates the HTML/DOM for one class info file */
		// ----------------------------------------------------------------------------------------
		function ClassRenderer(infoset, controller_inst) {

			controller_inst = controller_inst || new controller.ClassController();

			var get_method_link_name = function(name, index) {
				return 'method_' + name + '_' + index;
			};

			// Get a string with the method index of the class
			var get_class_main_page = (function() {
				var class_main_page = null;
				return function() {
					if(class_main_page == null) {
						// build methods index
						var builder = [];
						for (var name in infoset.members) {
							var overloads = infoset.members[name];

							for(var i = 0; i < overloads.length; ++i) {
								var data = overloads[i];
								var params = $.extend({
									link_info : get_method_link_name(data.name, i)
								}, data);	

								builder.push((name === infoset.name 
									? ctor_index_entry_template 
									: method_index_entry_template)(params));
							}
						}
						
						// put together written doc and methods index
						var text = class_template(infoset);
						var index = builder.join('');

						// wrapping it in a div is necessary to be able to use find() on the
						// returned jQuery selector. Using filter() and stuff should 
						// theoreticaly also work without the container, but causes weird
						// scrollbar problems.
						class_main_page = $('<div>' + text + method_index_template({ index : index }) + '</div>');

						// fix up list formatting
						class_main_page.find('.index li').addClass("dontsplit");
						
						// TODO: does not work
						//class_main_page.find('.index').columnize({
						//	columns: 2
						//});
				
						// and prepare for syntax highlighting
						class_main_page.find('pre').addClass("prettyprint lang-java");
					}
					return class_main_page;
				}
			})();

			// Get a jq DOM fragment with the full methods documentation for the class
			var get_methods = (function() {
				var methods = null;
				return function() {
					if(methods == null) {
						var builder = [];
						var n = 0;
						for (var name in infoset.members) {
							var overloads = infoset.members[name];

							for(var i = 0; i < overloads.length; ++i) {
								var data = overloads[i];
								var params = $.extend({
									  link_info : get_method_link_name(data.name, i)
									, index_in_class : n++
								}, data);

								builder.push(method_full_template(params));
							}
						}
						methods = $(builder.join(''));
					}

					return methods;
				}
			})();

			
		

			/** Show a preview of the class - a short brief - on the right view plane */
			this.preview_to = function(view_plane_manager) {
				view_plane_manager.set('', get_class_main_page());
			};


			/** Open the full class view in both planes */
			this.push_to = function(view_plane_manager) {
				var class_main_page = get_class_main_page();
				view_plane_manager.push(class_main_page, get_methods());

				// establish link handlers to resolve methods
				class_main_page.find('a').each(function() {
					var $this = $(this);
					var target = $this.attr('href');

					$this.hover(function() {
						controller_inst.select_method(view_plane_manager, target);
					});
				});
			};
		}


		return {
			ClassRenderer : ClassRenderer
		};
	})();

	

	var get_loading_html = function() {
		return loading_template({text:'Loading Preview'});
	};


	var open_class = this.open_class = function(file, completion, settings) {
		settings = settings || {};

		var preview = settings.preview || false;
		var show_loading = settings.show_loading === undefined ? true : settings.show_loading;

		if(show_loading) {
			view_planes.set(null, get_loading_html(), {
				no_scollbars : true,
			} );
		}

		fetch_infoset(file, function(infoset) {
			if (!infoset) {
				if (completion) {
					completion(false);
				}	
				return;
			}
			var renderer = new view.ClassRenderer(infoset);

			if(preview) {
				renderer.preview_to(view_planes);
			}
			else {
				renderer.push_to(view_planes);
			}

			if(completion) {
				completion(true);
			}
		});
	};

	this.push_view = function(left, right, settings) {
		view_planes.push(left, right, settings);
	};

	this.pop_view = function(settings) {
		view_planes.pop(settings);
	};


	if(!settings.no_search) {
		// generate search box logic
		var index = fetch_infoset('output/index.json', function(index) {
			elems = [];
			for (var k in index) {
				elems.push(index_entry_java_class_template({
					  name    : k
					, package : 'java.blubb'
					, brief : 'This is important'
				}));
			}

			var e = $('#live_search');
			e.html(elems.join(''));

			var closed = true;
			$('#searchbox')
				.on('input', function() {
					if(!e.is(":visible")) {
						closed = false;
						e.show({
							  duration: 300 * fade_speed_multiplier
							, done: function() {
								e.mCustomScrollbar({
									theme: "dark-thick" 
								});
							}
						});
					}
					return true;
				})
				.liveUpdate( e, function() {
					e.mCustomScrollbar("update");
					e.find('li.search_entry_java_class')
						.hover(function() {
							if(closed) {
								return;
							}
							var settings = {
								preview : true
							};
							var name = $(this).children('span.class_name').text();
							open_class('output/class_' + name + '.json', function() {}, settings);
						})

						.click(function() {
							closed = true;
							e.hide({
								duration: 300 * fade_speed_multiplier
							});
							var settings = {
								preview : false
							};
							var name = $(this).children('span.class_name').text();
							open_class('output/class_' + name + '.json', function() {}, settings);
						});
					} 
				);
			;
		});
	}
}; 
})(jQuery);


function run() {
	var doc = new DocumentationViewer();
	doc.open_class('output/class_Window.json');
}
