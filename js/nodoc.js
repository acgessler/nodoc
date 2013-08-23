
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
		'<li id="index_<%= link_info %>"> '+
			'<a data-target="<%= link_info %>"> '+
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

			// TODO: make it so that we can query the DOM node once and cache it -
			// right now the node may change.

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
			};

			this.update_scrollbars = function() {
				$(str_selector).mCustomScrollbar("update");
			};
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

			this.update_scrollbars = function() {
				_left.update_scrollbars();
				_right.update_scrollbars();
			};
		};

		return {
			  ViewPlaneManager : ViewPlaneManager
			, ViewPlane : ViewPlane
		};
	})();



	// namespace for Controller components - mostly actions for different kinds of UI entities
	var controller = this.controller = (function() {

		// ----------------------------------------------------------------------------------------
		/**  */
		// ----------------------------------------------------------------------------------------
		function ClassController(infoset) {

			var last_timeout_id = null;

			/** Previews a method 
			 *  @param view_plane_manager UI reference
			 *  @param target Target method name (TODO) 
			 *  @param restore */
			var _preview_method = function(class_renderer, target, restore, delay) {
				var doit = function() {
					last_timeout_id = null;
					class_renderer.get_method_renderer().scope_details_to_single_func(restore ? null : target);
				};
				if(last_timeout_id !== null) {
					clearTimeout(last_timeout_id);
					last_timeout_id = null;
				}
				if(delay) {
					last_timeout_id = setTimeout(doit, delay);
				}
				else {
					doit(); 
				}
			};


			var _select_method = function(class_renderer, target) {
				var view_plane_manager = class_renderer.get_active_view_planes_manager();
				// resolve the link
				var link = $('#' + target);
				if(link.length === 0) {
					// ignore, but maybe log (TODO)
					return;
				}

				class_renderer.get_method_renderer().scope_details_to_single_func(null);
				view_plane_manager.right().scrollTo(link, {
					scrollInertia : 105
				});
			};


			/** Registers event handler for an explicit method link */
			this.add_method_link_entry = function($elem, class_renderer) {
				var view_plane_manager = class_renderer.get_active_view_planes_manager();
				var target = $elem.data('target');

				$elem.mouseenter(function() {
					_preview_method(class_renderer, target);
					return false;
				});

				$elem.mouseleave(function() {
					// give it a small delay until we undo the preview
					_preview_method(class_renderer, target, true, 200 );
					return false;
				});

				$elem.click(function(e) {
					e.preventDefault();
					_select_method(class_renderer, target, undefined, 100 );
					return false;
				});
			};


			/** Registers event handler for automatically-generated link to an arbitrary code
			 *  entity. Such links appear in plain text of both class and method descriptions. */
			this.add_text_auto_link_entry = function($elem, class_renderer) {
				var view_plane_manager = class_renderer.get_active_view_planes_manager();
				var target = $elem.text();

				// ## check if this a link to the current class - ignore it then.
				if(target === infoset.name) {
					return;
				}

				// ## check if this link can be resolved to a method in the current class
				var on_leave = null;
				var on_enter = null;
				var on_click = null;
				if(target in infoset.members) {
					var method_link = class_renderer.get_method_renderer().get_method_link_name(target,0);
					on_leave = function() {
						// give it a small delay until we undo the preview
						_preview_method(class_renderer, method_link, true, 200 );
					};

					on_enter = function() {
						// give it a small delay until we show the preview
						_preview_method(class_renderer, method_link, undefined, 100 );
					};

					on_click = function() {
						_select_method(class_renderer, method_link, undefined, 100 );
					};
				}
				// ## else see if the symbol can be resolved in a parent class
				// TODO

				if(!on_enter || !on_leave) {
					return;
				}

				// add link-like styling
				$elem.addClass('autolink');
				
				$elem.mouseleave(function() {
					on_leave();
					return false;
				});

				$elem.mouseenter(function() {
					on_enter();
					return false;
				});

				// not every auto-link need to be clickable
				if(on_click) {
					$elem.click(function(e) {
						e.preventDefault();
						on_click();
						return false;
					});
				}
			};
		};

		return {
			ClassController : ClassController
		};
	})();


	// namespace for View components - mostly renderers for different types of Java entities
	var view = this.view = (function() {

		// ----------------------------------------------------------------------------------------
		/** Generates the HTML/DOM for the methods view of a class (both index and detail view) */
		// ----------------------------------------------------------------------------------------
		function MethodRenderer(class_renderer, members) {

			var index = null;
			var methods = null;

			var _index_includes_parent_methods = false;
			var _minimum_protection_level = 'private';

			var _scope_details_to_single_func = null;


			var _update_index = function() {
				console.log("niy: _update_index");

				var v = class_renderer.get_active_view_planes_manager();
				v.update_scrollbars();
			};

			var _update_details = function() {
				methods.find('div.method').each(function() {
					var $this = $(this);
					var id = $this.attr('id');

					if(_scope_details_to_single_func) {
						if(id === _scope_details_to_single_func) {
							$this.hide();
							$this.fadeIn();
						}
						else {
							$this.hide();
						}
					}
					else {
						$this.toggle(true);
					}
				});

				var v = class_renderer.get_active_view_planes_manager();
				v.update_scrollbars();
			};

			/** Get an unique name ("link name") to identify a method based on its name and 
			 *  its index in the list of overloads sharing this name. */
			var get_method_link_name = this.get_method_link_name = function(name, index) {
				return 'method_' + name + '_' + index;
			};


			/** Property that determines whether the details view is scoped to a single 
			 *  function which is given by a link name. */
			var scope_details_to_single_func = this.scope_details_to_single_func = function(link_name) {
				if(link_name === undefined) {
					return _scope_details_to_single_func;
				}

				_scope_details_to_single_func = link_name;
				_update_details();
			};


			/** Property that determines whether parent methods are included in the index  */
			var index_includes_parent_methods = this.index_includes_parent_methods = function(doit) {
				if(doit === undefined) {
					return _index_includes_parent_methods;
				}

				// TODO!
				console.log("niy: include_parent_methods");

				_index_includes_parent_methods = doit;
				_update_index();
			};


			/** Property that determines up to which access level methods are included
			 *  in both index and methods view.
			 *  Possible values: "public", "protected", "", "private"  */
			var minimum_protection_level = this.minimum_protection_level = function(level) {
				if(doit === undefined) {
					return _minimum_protection_level;
				}

				// TODO!
				console.log("niy: minimum_protection_level");

				if(minimum_protection_level !== level) {
					minimum_protection_level = level;
					_update_index();
					_update_detail();
				}
			};


			/** Get the index for the methods of the class */
			var get_index = this.get_index = function() {
				if(index === null) {

					// build methods index 
					var builder = [];
					for (var name in members) {
						var overloads = members[name];

						for(var i = 0; i < overloads.length; ++i) {
							var data = overloads[i];
							var params = $.extend({
								link_info : get_method_link_name(data.name, i)
							}, data);	

							builder.push((name === class_renderer.get_name()
								? ctor_index_entry_template 
								: method_index_entry_template)(params));
						}
					}
					index = method_index_template( {
						index : builder.join('')
					});

					// wrap in a <div>
					index = $('<div>' + index + '</div>');
				}
				return index;
			};

			/** Get the full methods documentation for the class */
			var get_detail = this.get_detail = function() {
				if(methods == null) {
					var builder = [];
					var n = 0;
					for (var name in members) {
						var overloads = members[name];

						for(var i = 0; i < overloads.length; ++i) {
							var data = overloads[i];
							var params = $.extend({
								  link_info : get_method_link_name(data.name, i)
								, index_in_class : n++
							}, data);

							builder.push(method_full_template(params));
						}
					}
					methods = builder.join('');

					// wrap in a <div>
					methods = $('<div>' + methods + '</div>');
				}

				return methods;
			};
		};

		// ----------------------------------------------------------------------------------------
		/** Generates the HTML/DOM for one class info file */
		// ----------------------------------------------------------------------------------------
		function ClassRenderer(infoset, controller_inst) {

			controller_inst = controller_inst || new controller.ClassController(infoset);
			var self = this;

			var _view_planes_manager = null;

			/** Get class name without package */
			var get_name = this.get_name = function() {
				return infoset.name;
			};

			/** Get aggregate MethodRenderer for this class */
			var get_method_renderer = this.get_method_renderer = (function() {
				var method_renderer = null;
				return function() {
					if(method_renderer === null) {
						method_renderer = new MethodRenderer(self, infoset.members);
					}
					return method_renderer;
				}
			})();

			/** Get the main description page for the class, including the methods index */
			var get_class_main_page = this.get_class_main_page = (function() {
				var class_main_page = null;
				return function() {
					if(class_main_page === null) {
						var method_renderer = get_method_renderer();
						var text = class_template(infoset);
						
						// wrapping it in a div is necessary to be able to use find() on the
						// returned jQuery selector. Using filter() and stuff should 
						// theoreticaly also work without the container, but causes weird
						// scrollbar problems.
						class_main_page = $('<div>')
							.append(text)
							.append(method_renderer.get_index());

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

			/** Show a preview of the class - a short brief - on the right view plane */
			this.preview_to = function(view_planes_manager) {
				// TODO: remove from previous view planes manager?
				view_planes_manager.set('', get_class_main_page());
				_view_planes_manager = view_planes_manager;
			};

			/** Open the full class view in both planes */
			this.push_to = function(view_planes_manager) {
				// TODO: remove from previous view planes manager?
				var class_main_page = get_class_main_page();
				view_planes_manager.push(class_main_page, get_method_renderer().get_detail());

				_view_planes_manager = view_planes_manager;

				// establish link handlers to resolve methods
				class_main_page.find('a').each(function() {
					controller_inst.add_method_link_entry($(this), self);
				});

				
				class_main_page.find('code').each(function() {
					controller_inst.add_text_auto_link_entry($(this), self);
				});

				// also auto-link types in code snippets already highlighted
				// by prettyprinter. TODO: get a callback
				setTimeout(function() {
					class_main_page.find('span.typ').each(function() {
						controller_inst.add_text_auto_link_entry($(this), self);
					})
				}, 1000);
			};

			this.get_active_view_planes_manager = function() {
				return _view_planes_manager;
			};
		}


		return {
			  ClassRenderer : ClassRenderer
			, MethodRenderer : MethodRenderer
		};
	})();



	var view_planes = new ui.ViewPlaneManager();

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
