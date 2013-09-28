
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

	# matches a javadoc comment on top of a field, along with the field declaration
	, 'java-field-head' : r""" 
		# start of multiline comment
		\/\*\*		
		# actual comment
		(.*?)		
		# end of multiline comment
		\*\/\s*		

		# java access specifier
		(public|private|protected|)\s*	
		# java modifiers
		((?:(?:final|synchronized|static)\s+)*)	
		# type, cannot be further tackled with a regex		
		(\S*?)\s+						
		# name of the field
		(\w+?)\s+												
	"""
}

for k in list(rex.keys()):
	rex[k] = re.compile(rex[k], re.DOTALL | re.VERBOSE)


class JavaHTMLFormatter(object):
	"""Static utilities for formatting JavaDoc snippets to HTML"""


	@staticmethod
	def javadoc_strip_asterisks(block):
		"""
		Given a javadoc annotated text block, strip any trailing asterisks from each line.
		"""
		# TODO: also handle line comments
		lines = [line.strip() for line in block.split('\n') if len(line.strip()) > 0]
		lines = [line[1:] if line[0] == '*' else line for line in lines]
		return '\n'.join(lines)


	@staticmethod
	def javadoc_block_to_html(block, run_markdown = True, strip_p_envelope = False):
		"""
		Given a javadoc annotated text block, generate appropriate HTML
		"""
		block = JavaHTMLFormatter.javadoc_strip_asterisks(block);

		block = re.sub(r'@author(.*?)$',r'Authors: __\1__', block)
		block = re.sub(r'\{\s*@code\s+(.*?)\s*\}',r'<tt>\1</tt>', block) # todo: regex cannot handle this
		block = re.sub(r'\{\s*@link\s+(.*?)\s*\}',r'\1</tt>', block) 
		
		res = markdown.markdown(block) if run_markdown else block

		# strip the outer <p> </p> block that markdown generates?
		if strip_p_envelope:
			while True:
				old = res
				res = re.sub(r'^\s*<p>(.*)<\/p>\s*$',r'\1', res);
				if old == res:
					break
		return res


	@staticmethod
	def javadoc_method_extract_param_doc(block):
		"""
		Extracts parameter documentation from a JavaDoc method doc.

		Produces a dictinary mapping parameter names to dox.
		"""
		params_out = {}
		for match in re.findall(r'@param\s*(.*?)\s+(.*?)(?=@|\n\s*\n|$)',block, re.DOTALL):
			html = JavaHTMLFormatter.javadoc_block_to_html(match[1], strip_p_envelope=True)
			params_out[match[0]] = html

		return params_out


	@staticmethod
	def javadoc_method_extract_exceptions(block):
		"""
		Extracts exception documentation from a JavaDoc method doc.

		Produces a dictionary mapping exception types to dox.
		"""
		exceptions_out = {}
		for match in re.findall(r'@(?:throws?|exception)\s*(.*?)\s+(.*?)(?=@|\n\s*\n|$)',block, re.DOTALL):
			html = JavaHTMLFormatter.javadoc_block_to_html(match[1], strip_p_envelope=True)
			exceptions_out[match[0]] = html

		return exceptions_out


	@staticmethod
	def javadoc_method_extract_references(block):
		"""
		Extracts external or internal references (@see) from a JavaDoc method doc.

		Produces a list of references (in input order).
		"""
		return re.findall(r'@see\s+(.*?)(?=@|\n\s*\n|$)',block, re.DOTALL)


	@staticmethod
	def javadoc_method_extract_since(block):
		"""
		Extracts the value of the @since attribute, if any.

		Produces a single string (empty if not found).
		"""
		res = re.search(r'@since\s+(.*?)(?=@|\n\s*\n|$)',block, re.DOTALL)
		return res.group(1) if res else ''


	@staticmethod
	def javadoc_method_extract_return(block):
		"""
		Extracts the value of the @return attribute, if any.

		Produces a single string (empty if not found).
		"""
		res = re.search(r'@returns?\s+(.*?)(?=@|\n\s*\n|$)',block, re.DOTALL) or ''
		return res.group(1) if res else ''


	@staticmethod
	def javadoc_method_doc_to_html(block, run_markdown = True):
		"""
		Given a javadoc annotated method commentary, generate appropriate HTML,
		dropping the commentary for parameters and references.
		"""

		block = JavaHTMLFormatter.javadoc_block_to_html(block, run_markdown = False)

		# notes are currently baked into the html
		block = re.sub(r'@note(.*?)',r'<br> __Note__: \1', block)
		
		# drop all tag blocks. Use a whitelist to make sure we don't accidentially
		# eat tag blocks that are not extracted before
		block = re.sub(r'@(see|param|since|throws?|exception|returns?)\s+(.*?)(?=@|\n\s*\n|$)',
			'', block, 0, re.DOTALL)

		return markdown.markdown(block) if run_markdown else block


	@staticmethod
	def javadoc_field_doc_to_html(*args, **kwargs):
		return JavaHTMLFormatter.javadoc_method_doc_to_html(*args, **kwargs)


class ParseError(Exception):
	def __init__(self, str):
		Exception.__init__(self, str)


class JavaField(object):
	"""
	Temporary representation for a partially parsed Java field.
	"""

	def __init__(self, regex_match):
		"""
		`regex_match` - match against rex['java-field-head']
		"""
		comment, access_spec, extra_spec, type, name = regex_match.groups()

		self.name = name
		self.access_spec = access_spec
		self.extra_spec = extra_spec
		self.comment = JavaHTMLFormatter.javadoc_strip_asterisks(comment)
		self.type = type.strip()
		self.refs = JavaHTMLFormatter.javadoc_method_extract_references(self.comment)
		self.since = JavaHTMLFormatter.javadoc_method_extract_since(self.comment)

	def get_infoset(self):
		import copy
		info = copy.copy(self.__dict__)
		info['comment'] = JavaHTMLFormatter.javadoc_field_doc_to_html(info['comment'])
		info['type'] = 'field'
		return info


class JavaMethod(object):
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
		self.comment = JavaHTMLFormatter.javadoc_strip_asterisks(comment)
		self.return_type = return_type.strip()
		self.parameters = JavaMethod.parse_parameters(params, self.comment)
		self.refs = JavaHTMLFormatter.javadoc_method_extract_references(self.comment)
		self.throws = JavaHTMLFormatter.javadoc_method_extract_exceptions(self.comment)
		self.since = JavaHTMLFormatter.javadoc_method_extract_since(self.comment)
		self.returns = JavaHTMLFormatter.javadoc_method_extract_return(self.comment)

	@staticmethod
	def parse_parameters(unparsed_parameter_block, method_doc):
		unparsed_parameter_block = unparsed_parameter_block.strip()
		if not unparsed_parameter_block:
			return []

		dox = JavaHTMLFormatter.javadoc_method_extract_param_doc(method_doc)

		params = []
		source = enumerate(unparsed_parameter_block)
		i = 0
		# very unpythonic string parsing code. We could just use a parser gen
		while True:
			if i >= len(unparsed_parameter_block):
				break

			# skip leading whitespace
			while True:
				try:
					i,c = next(source)
				except StopIteration:
					raise ParseError('failed to parse params (2): ' + unparsed_parameter_block)

				if not c.isspace():
					break

			# parse type, correctly skip over generic <,> blocks
			nest = 0

			start_idx = i
			while True:
				try:
					i,c = next(source)
				except StopIteration:
					raise ParseError('failed to parse params: ' + unparsed_parameter_block)
				if c == '<':
					nest += 1;
				elif c == '>':
					assert nest > 0
					nest -= 1;

				if nest == 0 and c.isspace():
					param_type = unparsed_parameter_block[start_idx:i]
					if not param_type:
						raise ParseError('failed to parse parameter type: ' + unparsed_parameter_block)
					
					assert param_type == param_type.strip()
					break

			assert nest == 0

			# parse parameter name
			start_idx = i
			while True:
				try:
					i,c = next(source)
					if c == ',':
						break
				except StopIteration:
					i += 1
					break

			param_name = unparsed_parameter_block[start_idx:i].strip()
			if not param_name:
				raise ParseError('failed to parse parameter name: ' + unparsed_parameter_block)

			params.append((param_type, param_name, dox.get(param_name, "")));
		return params

	def get_infoset(self):
		import copy
		info = copy.copy(self.__dict__)
		info['comment'] = JavaHTMLFormatter.javadoc_method_doc_to_html(info['comment'])
		info['type'] = 'method'
		return info


class JavaClass(object):
	"""
	Temporary representation for a partially parsed Java class.
	"""
	def __init__(self, regex_match, unparsed_block):
		"""
		`regex_match` - match against rex['java-class-head']
		`unparsed_block` - all text up until the closing braces of the class
		"""
		self.members = {}

		comment, access_spec, abstract_final_spec, class_interface_spec, name = regex_match.groups()
		self.comment = comment
		self.access_spec = access_spec
		self.abstract_final_spec = abstract_final_spec
		self.class_interface_spec = class_interface_spec
		self.name = name

		# TODO: drop inner classes
		for match in re.finditer(rex['java-method-head'], unparsed_block):
			method = JavaMethod(match)
			self.members.setdefault(method.name,[]).append(method)

		for match in re.finditer(rex['java-field-head'], unparsed_block):
			field = JavaField(match)
			self.members.setdefault(field.name,[]).append(field)


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

		for name, overloads in self.members.items():
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
		into the `entries` dictionary.
		"""
		for match in re.finditer(rex['java-class-head'], buffer):
			end_head = match.end()

			class_body_range = JavaProcessor.extract_braced_section(buffer, end_head)
			if class_body_range is None:
				continue

			# TODO: handle inner classes
			#self.find_classes(buffer[class_body_range[0]:class_body_range[1]], entries)
			try:
				c = JavaClass(match,buffer[class_body_range[0]:class_body_range[1]])
				entries[c.name] = c
			except ParseError as p:
				print('Error parsing class, ignoring: ' + str(p))
				
			
			




	


	

