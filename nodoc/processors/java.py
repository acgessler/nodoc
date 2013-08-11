
from nodoc import Processor

import re
import json
import markdown
import os


rex = {
	# matches a javadoc comment on top of a class, along with the class declaration
	'java-class-head': r"""
		# start of multiline comment
		\/\*\*		
		# actual comment
		(.*?)		
		# end of multiline comment
		\*\/\s*		

		# java access specifier
		(public\s+|private\s+|protected\s+|)
		# java abstract and final (which are mutually exclusive)
		(abstract\s+|final\s+|)		
		# class or interface specifier
		(class|interface)\s+			
		# name of class or interface
		(\w+?)\s						
	"""

	# matches a javadoc comment on top of a method, along with the method declaration
	, 'java-method-head' : r""" 
		# start of multiline comment
		\/\*\*		
		# actual comment
		(.*?)		
		# end of multiline comment
		\*\/\s*		

		# java access specifier
		(public|private|protected|)\s*	
		# java modifiers
		((?:(?:abstract|final|synchronized|static|native)\s+)*)	
		# return type, cannot be further tackled with a regex		
		(\S*?)\s+						
		# name of the function
		(\w+?)\s*						
		# opening parameter block parentheses
		\(\s* 							
		# list of parameters, cannot be tackled with a regex
			(.*?)						
		# closing parameter block parentheses
		 \s*\)							
	"""
}

for k in list(rex.keys()):
	rex[k] = re.compile(rex[k], re.DOTALL | re.VERBOSE)


class JavaHTMLFormatter:
	"""Static utilities for formatting JavaDoc snippets to HTML"""

	@staticmethod
	def javadoc_block_to_html(block, symbol_resolver = None, run_markdown = True):
		"""
		Given a javadoc annotated text block, generate appropriate HTML
		"""
		lines = [line.strip() for line in block.split('\n') if len(line.strip()) > 0]
		lines = [line[1:] if line[0] == '*' else line for line in lines]
		block = '\n'.join(lines)

		block = re.sub(r'@author(.*?)$',r'Authors: __\1__', block)
		if symbol_resolver:
			block = re.sub(r'\b(' + '|'.join(symbol_resolver)+r')\b',r'<tt>[\1](www.example.com)</tt>', block)
		block = re.sub(r'\{\s*@code\s+(.*?)\s*\}',r'<tt>\1</tt>', block) # todo: regex cannot handle this
		block = re.sub(r'\{\s*@link\s+(.*?)\s*\}',r'\1</tt>', block) 
		return markdown.markdown(block) if run_markdown else block


	@staticmethod
	def javadoc_method_doc_to_html(block, symbol_resolver = None, run_markdown = True):
		"""
		Given a javadoc annotated method commentary, generate appropriate HTML
		"""

		block = JavaHTMLFormatter.javadoc_block_to_html(block, symbol_resolver, False)

		# extract all parameters and re-order them so they appear at the beginning
		params = {}
		def collect_param(match): 
			params[match.group(1)] = match.group(2)
			return ''

		block = re.sub(r'@param\s*(.*?)\s+(.*?)(?=@|\n\s*\n|$)',
			collect_param, block, 0, re.DOTALL)

		block = re.sub(r'@(?:throws?|exception)(.*?)(?=@|\n\s*\n|$)',
			r'<br><font color="darkred"> &dagger; </font> \1', block,
			0, re.DOTALL)

		block = re.sub(r'@return(.*?)(?=@|\n\s*\n|$)',
			r'<br><b>&crarr;</b> \1', block,
			0, re.DOTALL)

		block = re.sub(r'@note(.*?)',r'<br> __Note__: \1', block)

		param_text = ""
		for name, comment in params.items():
			param_text = param_text + '<br><b><font color="darkblue">'+name+'</font> &diams; </b>' + comment

		block = (param_text + '<br><br>' if param_text else '') + block
		return markdown.markdown(block) if run_markdown else block



class JavaMethod:
	"""
	Temporary representation for a partially parsed Java method.
	"""

	def __init__(self, regex_match):
		"""
		`regex_match` - match against rex['java-method-head']
		"""
		comment, access_spec, extra_spec, return_type, name, params = regex_match.groups()

		self.name = name
		self.access_spec = access_spec
		self.extra_spec = extra_spec
		self.comment = comment
		self.return_type = return_type.strip()
		self.parameters = JavaMethod.parse_parameters(params)

	@staticmethod
	def parse_parameters(unparsed_parameter_block):
		return unparsed_parameter_block #['(todo)']

	def get_infoset(self):
		import copy
		info = copy.copy(self.__dict__)
		info['comment'] = JavaHTMLFormatter.javadoc_method_doc_to_html(info['comment'])
		return info


class JavaClass:
	"""
	Temporary representation for a partially parsed Java class.
	"""
	def __init__(self, regex_match, unparsed_block):
		"""
		`regex_match` - match against rex['java-class-head']
		`unparsed_block` - all text up until the closing braces of the class
		"""
		self.methods = {}

		comment, access_spec, abstract_final_spec, class_interface_spec, name = regex_match.groups()
		self.comment = comment
		self.access_spec = access_spec
		self.abstract_final_spec = abstract_final_spec
		self.class_interface_spec = class_interface_spec
		self.name = name

		# TODO: drop inner classes
		for match in re.finditer(rex['java-method-head'], unparsed_block):
			method = JavaMethod(match)
			self.methods.setdefault(method.name,[]).append(method)


	def get_infoset(self):
		class_info = {}
		class_info['access_prefix'] = self.access_spec 
		class_info['extra_prefix'] = self.abstract_final_spec 
		class_info['type'] = self.class_interface_spec
		class_info['name'] = self.name
		class_info['since'] = 'TODO' 
		class_info['short_desc'] = "TODO"
		class_info['long_desc'] = JavaHTMLFormatter.javadoc_block_to_html(self.comment)
		members = class_info['members'] = {}

		for name, overloads in self.methods.items():
			out = []
			for overload in overloads:
				out.append(overload.get_infoset())
			members[name] = out

		return class_info


class JavaProcessor(Processor):
	"""
	Implements `Processor` for java/javadoc.
	"""
	
	def __init__(self):
		Processor.__init__(self)
		self.index = set()


	@staticmethod
	def extract_braced_section(buffer, start_cursor = 0):
		"""
		Extract next {} block from a text `buffer`, starting at `start_cursor`.
		The method properly handles nested curly braces.

		Returns (range_begin, range_end] that delimits the text contents in
		between the curly braces. Returns a `None` if there are no further
		braced blocks, or if an error occurs.
		"""

		# avoid copying the text buffer as it might be quite large
		nested = 0
		match_begin = -1

		cursor = start_cursor
		while cursor < len(buffer):
			if buffer[cursor] == '{':
				nested += 1
				if nested == 1:
					match_begin = cursor

			elif buffer[cursor] == '}':
				nested -= 1
				if nested == 0:
					return (match_begin+1, cursor)

			cursor += 1
		return None


	def add_to_docset(self, fullpath):
		"""
		Add all entities within the file given by `fullpath` to the docset
		"""
		print('Processing ' + fullpath)
		with open(fullpath, 'rt') as inp:
			buffer = inp.read()

			entries = {}
			self._find_classes(buffer, entries)
			self.docset[fullpath] = entries
			for k in entries.keys():
				self.index.add(k)

	def generate_json_doc(self, output_folder):
		"""
		Generate json infosets for all entries in the docset
		"""
		for fullpath, entities in self.docset.items():
			for name, entity in entities.items():
				with open(os.path.join(output_folder, 'class_' + name + ".json"), 'wt') as outp:
					outp.write(json.dumps(entity.get_infoset(),
						sort_keys=True,
						indent=4, 
						separators=(',', ': ')))

		self._generate_index(output_folder)


	def _generate_index(self,  output_folder):
		"""
		Generate index.json file
		"""
		with open(os.path.join(output_folder, 'index.json'), 'wt') as outp:
			outp.write(json.dumps(dict( (k,1) for k in self.index),
				sort_keys=True,
				indent=4, 
				separators=(',', ': ')))


	def _find_classes(self, buffer, entries):
		"""
		Given a text buffer, find all classes (inner and outer), parse them
		into JavaClass instances and add them indexed by (qualified) name 
		tio the `entries` dictionary.
		"""
		for match in re.finditer(rex['java-class-head'], buffer):
			end_head = match.end()

			class_body_range = JavaProcessor.extract_braced_section(buffer, end_head)
			if class_body_range is None:
				continue

			# TODO: handle inner classes
			#self.find_classes(buffer[class_body_range[0]:class_body_range[1]], entries)
			c = JavaClass(match,buffer[class_body_range[0]:class_body_range[1]])
			entries[c.name] = c
			
			




	


	

