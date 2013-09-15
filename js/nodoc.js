
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
				
		//		'<%= access_spec %> ' + 
				'<span class="method_spec"> <%= extra_spec %>  </span>' +
				'<span class="method_return_type try_auto_link"><%= return_type %></span>' +
		
				'<span class="method_name"> <%= name %> </span>' +
				'<span class="method_param_list"> (<%= param_list %>) </span>'+
			'</h3>  ' +
			'<table> <%= param_doc %> </table> ' +
			'<%= returns_block %>' +
			'<%= comment %>  ' +
			'<%= reference_block %> <hr> '+
		'</div>');

	var method_param_template = _.template(
		'<tr> <span class="param_doc"> ' + 
			' <td> <span class="param_doc_type try_auto_link"> <%= type %> </span> </td>'+
			' <td> <span class="param_doc_name"> <%= name %> </span> </td>'+
			' <td> <span class="param_doc_text"> <%= doc %>  </span> </td>'+
		'</span> <tr/>'
	);

	var method_reference_template = _.template(
		'<li> <span class="try_auto_link lazy_auto_link"> <%= target %> </span> </li>'
	);

	var method_reference_block_template = _.template(
		'<b> See also: </b> <span class="method_reference"><ul> <%= references %> </ul> </span>'
	);

	var method_returns_block_template = _.template(
		'<b> <font size="+1"> &crarr; </font> </b> <span class="method_returns"> <%= returns %> </span>'
	);

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

			var $anchor = $(str_selector);

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


				var duration = 200 * fade_speed_multiplier;

				successor = new_successor;

				var commit = function() {
					$anchor.empty();
					$anchor.append(successor.contents);

					var successor_copy = successor;
					if (!successor_copy.no_scrollbars) {
						$anchor.mCustomScrollbar({
						  	theme: "light2"
						  	, mouseWheelPixels: 600 
							, scrollButtons: {
      							  enable: true
    						}
						});
					}

					var commit = function() {
						$anchor.mCustomScrollbar("update");

						// TODO: do async and narrow down focus
						prettyPrint();
					};

					if(successor.no_fade) {
						commit();
					}
					else {
						$anchor.fadeIn(duration, commit);
					}
					successor = null;
				};

				if (successor.no_fade) {
					commit();
				}
				else {
					$anchor.fadeOut(duration, commit);
				}
			};

			this.push = function(contents, settings) {
				
				if(contents != null) {
					page_stack.push($anchor.children().detach());
					this.set(contents, settings);
				}
				else {
					page_stack.push(null);
				}
			};

			this.pop = function(settings) {
				var elem = page_stack[page_stack.length - 1];
				if(elem !== null) {
					$anchor.empty();
					$anchor.append(elem);
				}
				page_stack.pop();
			};

			this.scrollTo = function(selector, settings) {
				// have to get the ID because scrollTo does not accept arbitrary jQuery selectors
				var el_id = '#' + $(selector).first().attr('id');
				$anchor.mCustomScrollbar("scrollTo",el_id, settings);
			};

			this.update_scrollbars = function() {
				$anchor.mCustomScrollbar("update");
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


	// namespace for Model components - mostly thin wrappers around the json infosets 
	// derived from the original javadoc
	var model = this.model = (function() {

		// ----------------------------------------------------------------------------------------
		/**  Abstract index implementation that is able to deal with both package-level and
		 *   class-level index */
		// ----------------------------------------------------------------------------------------
		function ContainerModel(infoset, parent) {

			this.get_type = function() {
				return infoset.type;
			};


			this.get_name = function() {
				return infoset.name;
			};


			this.get_parent = function() {
				return parent;
			};


			/** Return a dictionary of members, each of which is an Array to
			 *  accomodate for overloaded names. The array elements are objects
			 *  which either expose a `ref` property indicating a sub-container,
			 *  or they are aggregate members with members depending on the
			 *  type of the container (i.e. methods). 
			 *
			 *  To handle sub containers, use `get_sub_container()`.
			 **/
			this.get_members = function() {
				return infoset.members;
			};


			this.get_short_desc = function() {
				return infoset.short_desc;
			};


			this.get_long_desc = function() {
				return infoset.desc;
			};


			/** Get a sub-container with a specific name. Returns false if the
			 *  member does not exist, or is not a container. The callback 
			 *  receives a ContainerModel-derived class or a null if the data
			 *  for the container could not be obtained.  */
			this.get_sub_container = function(name, callback) {
				var cont = infoset.members[name];
				if(!cont.ref) {
					return false;
				}

				return fetch_infoset(cont.ref, function(infoset) {
					callback(make_container(infoset));
				});

				return true;
			};
		};

		// ----------------------------------------------------------------------------------------
		/**  */
		// ----------------------------------------------------------------------------------------
		function PackageModel(infoset) {
			ContainerModel.apply(this);
		};

		PackageModel.prototype = new ContainerModel();

		// ----------------------------------------------------------------------------------------
		/**  */
		// ----------------------------------------------------------------------------------------
		function ClassModel(infoset) {

		};

		return {
			ContainerModel : ContainerModel,
			ClassModel : ClassModel
		};
	}());

	// namespace for Controller components - mostly actions for different kinds of UI entities
	var controller = this.controller = (function() {

		// ----------------------------------------------------------------------------------------
		/** PageController */
		// ----------------------------------------------------------------------------------------
		function PageController(view_planes_manager) {

			var _get = function(what, completion) {
				var renderer_factory = function(model) {
					// TODO: different renderer types depending on model type
					return new view.ClassRenderer(model);
				};

				if(_.isString(what)) {
					fetch_infoset('output/class_' + what + '.json', function(infoset) {
						if (!infoset) {
							if (completion) {
								completion(false);
							}	
							return;
						}

						// TODO: allocate model wrapper instance instead of using the raw data
						completion(infoset, renderer_factory(infoset));
					});
				}
				else {
					completion(what, renderer_factory(what));
				}
			};

			var _show_loading_screen = function() {
				var show_loading = settings.show_loading === undefined ? true : settings.show_loading;

				if(show_loading) {
					view_planes_manager.set(null, get_loading_html(), {
						no_scollbars : true,
					} );
				}
			};

			// 0: left, 1: right
			var _preview = function(left_or_right, what, settings, completion) {
				var undo = null;
				_get(what, function(model, renderer) {
					if(!model) {
						if(completion) {
							completion(false);
						}
						return;
					}

					undo = renderer.preview_to(left_or_right,view_planes_manager, true);

					if(completion) {
						completion(true);
					}
				});


				// return a future to undo the operation
				return function() {
					if(undo) {
						undo();
					}
				};
			};

			return {
				get_view_planes_manager : function() {
					return view_planes_manager;
				},


				open : function(what, settings, completion) {
					settings = settings || {};

					_show_loading_screen(settings);
					
					_get(what, function(model, renderer) {
						if(!model) {
							if(completion) {
								completion(false);
							}
							return;
						}

						renderer.push_to(view_planes_manager);

						// add a history record to ease browser navigation
						if(!settings.no_history) {
							console.log('push: ' + model.name);

							history.pushState({ 
							 	  what : model.name
							}, 
							"TODO", "#class=" + model.name);
						}

						if(completion) {
							completion(true);
						}
					});
				},

				preview : _preview,

			
				preview_left : function(what, settings, completion) {
					return _preview(0, what, settings, completion);
				},


				preview_right : function(what, settings, completion) {
					return _preview(1, what, settings, completion);
				},


				lookup : function(what, callback) {
					// TODO: more refined update logic
					_get(what, callback);
				}
			};
		};


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
				// TODO: support previewing on left side
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
			this.add_text_auto_link_entry = function($elem, class_renderer, left_or_right) {
				left_or_right = 1-(left_or_right || 0);

				var view_plane_manager = class_renderer.get_active_view_planes_manager();
				var target = $.trim($elem.text());

				// handle cases in which links to methods are made by giving
				// parentheses and possibly even parameter or parameter types.
				// We don't resolve overloads, though.
				if (target[target.length - 1] === ')') {
					var index = target.indexOf('(');
					if(index !== -1) {
						target = target.slice(0, index);
					}
				}

				// ## check if this a link to the current class - ignore it then.
				if(target === infoset.name) {
					return;
				}

				var on_leave = null;
				var on_enter = null;
				var on_click = null;

				var setup_autolink = function() {
					if(!on_enter || !on_leave) {
						return;
					}

					// add link-like styling
					$elem.addClass('autolink');
					
					// swallow the mouseleave() after a click()
					var closed = false;

					$elem.mouseleave(function() {
						if(closed) {
							return false;
						}
						on_leave();
						return false;
					});

					$elem.mouseenter(function() {
						if(closed) {
							return false;
						}
						on_enter();
						return false;
					});

					// not every auto-link need to be clickable
					if(on_click) {
						$elem.click(function(e) {
							closed = true;
							e.preventDefault();
							on_click();
							return false;
						});
					}
				};

				// ## check if this link can be resolved to a method in the current class
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


				// TODO - temporary HACK to get package siblings, assumes index is loaded
				// and callback is called immediately.
				page_controller.lookup(target, function(model) {
						if(!model) {
							return;
						}
	
						var undo = null;
						on_enter = function() {
							undo = page_controller.preview(left_or_right, model);
						};

						on_leave = function() {
							if(undo) {
								undo();
							}
						};

						on_click = function() {
							page_controller.open(model);
							
						};

						setup_autolink();
				});

				setup_autolink();
			};
		};

		return {
			  PageController : PageController
			, ClassController : ClassController
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

							var param_list_entries = [];
							for(var j = 0; data.parameters && j < data.parameters.length; ++j) {
								var p = data.parameters[j];
								param_list_entries.push(p[0] + ' ' + p[1]);
							}

							var params = $.extend({
								  link_info : get_method_link_name(data.name, i)
							}, data);	

							params.parameters = param_list_entries.join(', ');

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
							
							var param_dox_entries = [];
							//var param_list_entries = [];
							if(data.parameters) {
								for(var j = 0; j < data.parameters.length; ++j) {
									var p = data.parameters[j];
									//param_list_entries.push(p[0] + ' ' + p[1]);
									param_dox_entries.push(method_param_template({
										  type : p[0]
										, name : p[1]
										, doc  : p[2]
									}));
								}
							}

							var refs_dox_entries = [];
							if(data.refs) {
								for(var j = 0; j < data.refs.length; ++j) {
									refs_dox_entries.push(method_reference_template({
										  target : data.refs[j]
									}));
								}
							}

							var param_string = data.parameters ? data.parameters.length : '';
							var refs_block = !data.refs ? '' 
								: method_reference_block_template({
									references : refs_dox_entries.join('')
									});

							var returns_block = $.trim(data.returns) == 0 ? ''
								: method_returns_block_template({
									returns : data.returns
								});

							var params = $.extend({
								  link_info : get_method_link_name(data.name, i)
								, index_in_class : n++
								, param_doc : param_dox_entries.join('')
								, param_list : param_string
								, reference_block : refs_block
								, returns_block : returns_block
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

			// handle the 'a#b' syntax for referencing (external) members 
			// by reducing it to 'a.b' canonical form.
			var _replace_alternative_link_syntax = function(text) {
				return text.replace(/\b(\w*)#(\w+)\b/g, '$1.$2');
			};


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
						// TODO: invoke text = _replace_alternative_link_syntax(text);
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

			/** Show a preview of the class - a short brief - on the right view plane
			 *  and return a callable that undoes the preview. */
			this.preview_to = function(left_or_right, view_planes_manager, keep_other_side) {
				// TODO: remove from previous view planes manager?
				if(left_or_right === 0) {
					view_planes_manager.push(get_class_main_page(), keep_other_side ? null : '');
				} 
				else {
					view_planes_manager.push(keep_other_side ? null : '', get_class_main_page());
				}
				
				_view_planes_manager = view_planes_manager;

				return function() {
					view_planes_manager.pop();
				};
			};

			/** Open the full class view in both planes */
			this.push_to = function(view_planes_manager, no_history) {
				// TODO: remove from previous view planes manager?
				var class_main_page = get_class_main_page();
				var detail_page = get_method_renderer().get_detail();

				view_planes_manager.push(class_main_page, detail_page);
				_view_planes_manager = view_planes_manager;

				// when publishing the rendered class, add event handlers using the
				// Class Controller.

				var add_links = function(page, left_or_right) {
					// establish link handlers to resolve methods
					page.find('a').each(function() {
						controller_inst.add_method_link_entry($(this), self, left_or_right);
					});
					
					page.find('code').each(function() {
						controller_inst.add_text_auto_link_entry($(this), self, left_or_right);
					});

					page.find('.try_auto_link').each(function() {
						var $this = $(this);
						var target = $this.text();

						var newt = _replace_alternative_link_syntax(target);
						$this.text(newt);

						controller_inst.add_text_auto_link_entry($this, self, left_or_right);
					});

					// also auto-link types in code snippets already highlighted
					// by prettyprinter. TODO: get a callback
					setTimeout(function() {
						page.find('span.typ').each(function() {
							controller_inst.add_text_auto_link_entry($(this), self);
						})
					}, 1000);
				};

				add_links(class_main_page, 0);
				add_links(detail_page, 1);
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


	var page_controller = new controller.PageController(new ui.ViewPlaneManager());


	var get_loading_html = function() {
		return loading_template({text:'Loading Preview'});
	};



	this.push_view = function(left, right, settings) {
		view_planes.push(left, right, settings);
	};

	this.pop_view = function(settings) {
		view_planes.pop(settings);
	};

	this.open = function(what) {
		page_controller.open(what);
	};


	window.onpopstate = function(event) {
		if(!event.state) {
			return;
		}
    	console.log('pop: ' + event.state.what);

    	// TODO: handle more than just classes
    	page_controller.open(history.state.kind, history.state.what, null, {
    		no_history : true
    	});
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
	doc.open('GraphicsConfiguration');
}
