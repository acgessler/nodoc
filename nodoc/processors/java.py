
from nodoc import Processor

import re

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
		(public|private|protected|)\s+	
		# java abstract and final (which are mutually exclusive)
		(abstract|final|)\s+			
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
		(public|private|protected|)\s+	=
		# java modifiers
		((?:(?:abstract|final|synchronized|static)\s+)*)	
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

markdown_templates = {
	'java-class' :
r"""##<font size="-1"> {access_spec} {abstract_final_spec} {class_interface_spec} </font> {class_name} 

{block}
"""

	, 'java-method': 
r"""###<font size="-1"> {access_spec} {extra_spec} {return_type} </font> {name}({params})

{comment}
"""
}


for k in list(rex.keys()):
	rex[k] = re.compile(rex[k], re.DOTALL | re.VERBOSE)



class JavaMethod:
	"""
	Temporary representation for a partially parsed Java method.
	"""
	def __init__(self, name, return_type, unparsed_parameter_block):
		self.name = name
		self.return_type = return_type.strip()
		self.parameters = JavaMethod.parse_parameters(unparsed_parameter_block)

	@staticmethod
	def parse_parameters(unparsed_parameter_block):
		return ['(todo)']


class JavaClass:
	"""
	Temporary representation for a partially parsed Java class.
	"""
	def __init__(self, unparsed_block):
		self.methods = {}

	def add_method(self, method):
		assert isinstance(method, JavaMethod)
		self.methods[method] = method


class JavaProcessor(Processor):
	"""
	Implements `Processor` for java/javadoc.
	"""
	
	def __init__(self):
		Processor.__init__(self)


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
		"""
		print('Processing ' + fullpath)
		with open(fullpath, 'rt') as inp:
			buffer = inp.read()

			entries = []
			for match in re.finditer(rex['java-class-head'], buffer):
				end_head = match.end()

				class_body_range = JavaProcessor.extract_braced_section(buffer, end_head)

				groups = match.groups()
				self.symbols.add(groups[-1])
				entries.append( (buffer, class_body_range, match) )
			
			self.docset[fullpath] = entries

	def generate_doc(self, output_folder):
		"""
		"""
		import os

		for fullpath, matched in self.docset.items():
			for match in matched:
				self.write_class_doc(match, output_folder)



	# Internal


	def javadoc_block_to_markdown(self, block):
		"""
		Given a javadoc annotated text block, substitute appropriate HTML/Markdown
		"""
		lines = [line.strip() for line in block.split('\n') if len(line.strip()) > 0]
		lines = [line[1:] if line[0] == '*' else line for line in lines]
		block = '\n'.join(lines)

		block = re.sub(r'@author(.*?)$',r'Authors: __\1__', block)
		block = re.sub(r'\b(' + '|'.join(self.symbols)+r')\b',r'[\1](www.example.com)', block)
		block = re.sub(r'\{\s*@code\s+(.*?)\s*\}',r'<tt>\1</tt>', block) # todo: regex cannot handle this
		block = re.sub(r'\{\s*@link\s+(.*?)\s*\}',r'\1</tt>', block) 
		return block


	def write_class_doc(self, entry, output_folder):
		"""
		Given a class `entry` from the documentation set, write documentation to
		a file named <classname>.html in `output_folder`
		"""
		buffer, class_body_range, match = entry

		block, access_spec, abstract_final_spec, class_interface_spec, class_name = match.groups()
		if len(block) == 0:
			return

		block = self.javadoc_block_to_markdown(block)

		import markdown
		block = markdown.markdown(markdown_templates['java-class'].format(**locals()))

		methods = ""
		if not class_body_range is None:
			subset = buffer[class_body_range[0]:class_body_range[1]] # todo: get rid of copy
			for match in re.finditer(rex['java-method-head'], subset):
				comment, access_spec, extra_spec, return_type, name, params = match.groups()
				comment = self.javadoc_block_to_markdown(comment)

				methods = methods + markdown.markdown(
					markdown_templates['java-method'].format(**locals())
				)

		# github css for testing
		css = r'<link href="https://gist.github.com/andyferra/2554919/raw/2e66cabdafe1c9a7f354aa2ebf5bc38265e638e5/github.css" rel="stylesheet"></link>'

		import os.path
		with open(os.path.join(output_folder,class_name + ".html"), 'wt') as outp:
			# testing layout
			outp.write(css + '<div style="float: left; width: 45%;">' + block + '</div>' +
				'<div style="float:right; width: 45%;">' +  methods + '</div>') 

