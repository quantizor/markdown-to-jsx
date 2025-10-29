# Master Markdown Parsing Ruleset

This document consolidates all markdown parsing rulesets into a single comprehensive reference. The rules are organized by category for clarity and reference.

## Core Concepts and Foundations

### Characters and Lines

CHARACTER:unicode*code_point|any_code_point_counts
LINE:0+\_chars_not_lf_cr+line_ending_or_eof
LINE_ENDING:lf|cr_not_followed_by_lf|crlf
BLANK_LINE:no_chars|only_spaces|only_tabs
UNICODE_WS:Zs_category|tab|lf|ff|cr
SPACE:u+0020
TAB:u+0009
ASCII_CONTROL:u+0000-1f|u+007f
ASCII_PUNCTUATION:!|"|#|$|%|&|'|(|)|\*|+|,|-|.|/|:|;|<|=|>|?|@|[|\|]|^|*|`|{|}|~
UNICODE_PUNCTUATION:P_category|S_category

### Precedence

BLOCK_STRUCTURE:>inline_structure
INLINE_STRUCTURE:code_spans|links|images|html_tags|emphasis|strong_emphasis
BINDING_ORDER:code_spans=links=images=html_tags>emphasis=strong_emphasis>textual_content

### Blank Lines

DEFINITION:no_chars|only_spaces|only_tabs
IGNORED:between_block_elements|beginning_of_doc|end_of_doc
ROLE:determine_list_tight_loose|separate_paragraphs|separate_block_quotes

### Tabs

NOT_EXPANDED:to_spaces|internal_tabs_literal
CONTEXT_BLOCK_STRUCTURE:tab=4_spaces|tab_stop_4
USAGE:indented_code_block|list_continuation|block_quote_marker|indentation

### Insecure Characters

U+0000:must_be_replaced_with_REPLACEMENT_CHARACTER_u+fffd

### Backslash Escapes

ASCII_PUNCTUATION:may_be_escaped
ESCAPED_CHAR:treated_as_regular|no_markdown_meaning
BACKSLASH_ESCAPED:following_char_not_escaped
END_OF_LINE:hard_line_break
CONTEXTS_NOT_WORKING:code_blocks|code_spans|autolinks|raw_html
CONTEXTS_WORKING:urls|link_titles|link_references|info_strings

### Textual Content

DEFINITION:chars_not_given_interpretation|plain_textual_content
PRESERVED:internal_spaces_verbatim|unicode_chars|multiple_spaces

## Block Elements

### Paragraphs

DEFINITION:non_blank_lines|not_other_blocks
CONTENT:parse_as_inlines|concat_lines|strip_initial_final_ws
BLANK_LINES:cannot_contain|separate_paragraphs
INDENT:first_line_0-3|subsequent_any|4+indent=code_block
TRAILING_WS:stripped_before_parsing|no_hard_line_break
INTERRUPT:table_can_interrupt_paragraph|gfm_extension

### Headings

#### ATX Headings

OPEN:#{1-6} UNESCAPED:true FOLLOWED_BY:[space|tab|eol] INDENT:0-3
CLOSE:#{0+} UNESCAPED:true PRECEDED_BY:[space|tab] FOLLOWED_BY:[space|tab|eol] OPTIONAL:true
CONTENT:strip_leading_trailing_ws|parse_as_inline
LEVEL:open_count
INVALID:>6#|no_space_after|escaped#|4+indent|close_not_preceded_by_space|non_ws_after_close
PRECEDENCE:can_interrupt_paragraph|no_blank_line_required

#### Setext Headings

TEXT_LINES:1+ NO_BLANK_BETWEEN:true FIRST_LINE_INDENT:0-3 INTERPRETABLE_AS:paragraph|cannot_be_code_fence|cannot_be_atx_heading|cannot_be_block_quote|cannot_be_thematic_break|cannot_be_list_item|cannot_be_html_block
UNDERLINE:[=-] COUNT:>=1 INDENT:0-3 TRAILING_WS:allowed INTERNAL_WS:forbidden
LEVEL:=-1|-=2
CONTENT:concat_lines|strip_initial_final_ws|parse_as_inline
INVALID:4+indent|underline_internal_ws|lazy_continuation_in_blockquote|lazy_continuation_in_list_item|text_other_block_types|empty_heading
PRECEDENCE:setext_heading>thematic_break|cannot_interrupt_paragraph|blank_line_before_after:optional|blank_line_needed_after_paragraph

### Thematic Breaks

CHAR:[-_*] COUNT:>=3 SAME:true
INDENT:0-3
SPACING:between|trailing|allowed
INVALID:4+indent|wrong_char|count<3|mixed_chars|non_ws_chars
PRECEDENCE:setext_heading>thematic_break>list_item

### Block Quotes

MARKER:> INDENT:0-3 FOLLOWED_BY:[space|no_space]
BASIC:prepend_marker_to_lines_creates_blockquote
LAZINESS:delete\*>\_from_paragraph_continuation_only|not_for_other_block_types|paragraph_continuation_text_only
CONSECUTIVENESS:blank_line_required_between
INVALID:4+indent|consecutive_without_blank_line|lazy_on_non_paragraph

### Lists and List Items

#### Lists

DEFINITION:sequence_of_list_items|same_type|separated_by_blank_lines_allowed
SAME_TYPE:same_bullet_char|same_ordered_delimiter
ORDERED:ordered_markers|start_number=first_item_number|subsequent_numbers_ignored
BULLET:bullet_markers
LOOSE:blank_lines_between_items|two_block_elements_with_blank_line|paragraphs_wrapped_in_p_tags
TIGHT:not_loose|paragraphs_not_wrapped_in_p_tags
SEPARATION:blank_lines_allowed|any_number
CHANGING_MARKER:starts_new_list|different_bullet_char_or_delimiter
INTERRUPT_PARAGRAPH:bullet_lists_always|ordered_only_if_starts_with_1|principle_of_uniformity
PRECEDENCE:thematic_break>list_item
SEPARATE_CONSECUTIVE:blank_html_comment|blank_line

#### List Items

BULLET:[-+*]
ORDERED:digits{1-9}+[.))]
BASIC:lines_Ls=blocks_Bs marker_M width_W spaces_N{1-4} indent_subsequent_by_W+N
EXCEPTIONS:interrupt_paragraph=>Ls_no_blank_start|ordered_start=1|thematic_break_not_item
INDENT:marker_space_content:required|continuation_blocks:indented|marker_width_W_calculates_indentation
CONTENT:any_blocks|blank_lines_separated|preserve_empty_lines|can_start_with_blank_line|max_one_blank_line_start
START_NUMBER:first_item_determines|subsequent_ignored|max_9_digits|can_start_0|cannot_be_negative
INVALID:no_space_after_marker|thematic_break_in_item|start_number>9_digits|start_number_negative

##### List Item Formation Rules

RULE_1_BASIC:lines_Ls=blocks_Bs_non_space_start marker_M_width_W spaces_N{1-4} indent_subsequent_W+N
RULE_2_CODE_START:lines_Ls=blocks_Bs_indented_code_start marker_M_width_W one_space indent_subsequent_W+1
RULE_3_BLANK_START:lines_Ls_single_blank_start blocks_Bs marker_M_prepend_first_line indent_subsequent_W+1|empty_lines_need_not_indent
RULE_4_INDENTATION:add_up_to_3_spaces_per_line_still_valid_list_item|empty_lines_need_not_indent
RULE_5_LAZINESS:reduce_indentation_on_lazy_continuation_lines|paragraph_continuation_text_only|partial_reduction_allowed
RULE_6_THATS_ALL:nothing_not_covered_by_rules_1_5_counts_as_list_item
SUBLISTS:indent_same_as_paragraph_would_need|marker_width_determines_required_indent|insufficient_indent_creates_separate_list|follow_from_general_rules

##### Additional Constraints

EMPTY_ITEMS:cannot_interrupt_paragraph|can_be_first_or_last_in_list|can_have_multiple_spaces_or_tabs_after_marker
THEMATIC_BREAKS:cannot_be_list_items|take_precedence_over_list_items
MARKER_WIDTH:calculated_as_marker_length|examples*-1*+1\*\*1_1.\_3_10)\_4|determines_continuation_indent
EDGE_CASES:four_spaces_gives_code_block|more_than_3_spaces_prevents_list_item|indentation_not_consistent_across_items

##### Task List Items (GFM Extension)

TASK_LIST_ITEM:list_item+first_block_is_paragraph+paragraph_starts_with_task_marker
TASK_MARKER:optional_spaces+[+[whitespace|x|X]+]+at_least_one_whitespace_before_other_content
CHECKED:whitespace=unchecked|x_or_X=checked|case_insensitive
RENDERING:replaced_with_checkbox_element|input_type_checkbox|disabled_or_interactive_per_implementation
NESTING:can_be_arbitrarily_nested|task_lists_within_task_lists

### Code Blocks

#### Indented Code Blocks

INDENT:4+ REQUIRED:true TRAILING_WS:included BLANK_LINES:preserved
CONTENT:literal|line_endings_preserved|remove_4_spaces|preserve_extra_indent
END:<4_spaces_non_blank_line|blank_lines_excluded
INTERRUPT_PARAGRAPH:false|blank_line_required_before
CHUNKS:multiple|separated_by_blank_lines
PRECEDENCE:list_item>code_block

#### Fenced Code Blocks

OPEN:[`~]{3+} MIXED:false INDENT:0-3 INFO_STRING:optional|trim_ws|no_backticks_if_backtick_fence
CLOSE:SAME_TYPE|>=open_count INDENT:0-3 FOLLOWED_BY:[space|tab] ONLY
CONTENT:literal|between_fences|remove_indent_up_to_open_indent
UNCLOSED:extends_to_end|no_backtracking
INTERRUPT_PARAGRAPH:true|no_blank_line_required
INVALID:<3_fence|mixed_types|close_shorter|4+indent|internal_ws_in_fence|close_4+indent

### HTML Blocks

TYPE1:start:<pre|script|style|textarea(case_insensitive) +[space|tab|>|eol] end:close_tag(case_insensitive|need_not_match)
TYPE2:start:<!-- end:-->
TYPE3:start:<? end:?>
TYPE4:start:<!+ascii_letter end:>
TYPE5:start:<![CDATA[ end:]]>
TYPE6:start:<|</+block_tags(case_insensitive) +[space|tab|eol|>|/>] end:blank_line
TYPE7:start:complete_tag(single_line|open_tag|closing_tag|any_tag_name_except_pre_script_style_textarea) +[space|tab]{0+} +eol end:blank_line|interrupt_paragraph:false
INDENT:0-3
CONTINUATION:until_end_condition|end_of_doc|end_of_container
INTERRUPT_PARAGRAPH:types1-6:true|type7:false
NESTED_CONTENT:not_parsed|passed_through|html_within_block_ignored
BLOCK_TAGS:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul

## Inline Elements

### Emphasis and Strong Emphasis

DELIMITER*RUN:\*{1+}|*{1+}|not*preceded_by_non_backslash_escaped_same|not_followed_by_non_backslash_escaped_same
LEFT_FLANKING:not_followed_by_unicode_ws|(not_followed_by_unicode_punct|followed_by_unicode_punct_and_preceded_by_unicode_ws_or_punct)|beginning_of_line=unicode_ws|end_of_line=unicode_ws
RIGHT_FLANKING:not_preceded_by_unicode_ws|(not_preceded_by_unicode_punct|preceded_by_unicode_punct_and_followed_by_unicode_ws_or_punct)|beginning_of_line=unicode_ws|end_of_line=unicode_ws
OPEN_EMPHASIS:\*:left_flanking|*:left*flanking_and(not_right_flanking|right_flanking_preceded_by_unicode_punct)
CLOSE_EMPHASIS:\*:right_flanking|*:right\*flanking*and(not_left_flanking|left_flanking_followed_by_unicode_punct)
OPEN_STRONG:**:left_flanking|\_\_:left_flanking_and(not_right_flanking|right_flanking_preceded_by_unicode_punct)
CLOSE_STRONG:**:right_flanking|\_\_:right_flanking_and(not_left_flanking|left_flanking_followed_by_unicode_punct)
EMPHASIS:open_delimiter|close_delimiter|same_char|separate_delimiter_runs|if_both_open_close_sum_lengths_not_multiple_of_3_unless_both_multiple_of_3
STRONG:same_as_emphasis|double_delimiters
LITERAL:\*:cannot_begin_end\*\*\_emphasis|*:cannot*begin_end\_\_emphasis|unless_backslash_escaped
PRECEDENCE:minimize_nestings|em_strong_preferred_over_strong_em|first_overlapping_span_takes_precedence|shorter_span_same_closing_delimiter_takes_precedence|inline_code_links_images_html_tags_bind_more_tightly_than_emphasis
INTRAWORD:*:allowed|\_:not_allowed

#### Strikethrough (GFM Extension)

STRIKETHROUGH_DELIMITER:~~|exactly_two_tildes|cannot_nest|cannot_span_line_breaks|similar_parsing_to_emphasis
DELIMITER_STACK:add_to_stack|same_as_emphasis_delimiters
PARSING:new_paragraph_causes_parsing_to_cease|same_precedence_rules_as_emphasis

### Links

LINK_TEXT:[{0+inlines}]|zero_or_more_inline_elements|enclosed_by_square_brackets
LINK_TEXT_RULES:no_nested_links|inner_most_used_if_nested|brackets_allowed_if_escaped_or_matched_pair|backtick_code_autolinks_html_bind_tighter|brackets_bind_tighter_than_emphasis
LINK_DESTINATION:<...>|zero_or_more_chars|no_line_endings|no_unescaped_angle_brackets|OR|nonempty_no*<|no*ascii_control|no_space|parens_escaped_or_balanced|max_3_nesting|empty_ok_with\*<>|url_escaping_left_alone|entity_references_parsed_to_unicode|renderers_may_optionally_url_escape_in_output
LINK_TITLE:"..."|'...'|(...)|escaped_quotes|no_blank_line|span_multiple_lines|may_contain_entity_references|may_contain_backslash_escapes
INLINE_LINK:[text](destination|title|)|components_separated_by_ws_tabs_up_to_one_line_ending|destination_title_must_be_separated_by_ws_if_both_present|no_ws_between_text_and_opening_paren|unicode_whitespace_not_valid_for_separation
REFERENCE_LINK:full:[text][label]|collapsed:[text][]|shortcut:[text]|no_ws_between_text_and_label|no_ws_between_brackets_in_collapsed
LINK_REFERENCE_DEF:[label]:destination|title|indent_0-3|separated_by_ws|no_further_non_ws_char
LABEL:case_insensitive|first_match_wins|whitespace_trimmed|collapsed_empty|max_999_chars|at_least_one_non_whitespace|no_unescaped_brackets|unicode_case_fold|internal_ws_tabs_line_endings_collapsed_to_single_space|stripped_leading_trailing_ws_tabs_line_endings|matching_on_normalized_strings_not_parsed_content
DESTINATION_EMPTY:<>|empty_string|both_valid
PRECEDENCE:inline_links|full_reference|collapsed_reference|shortcut_reference|in_that_order
INVALID:spaces_in_destination_not_angle_brackets|line_endings_in_destination|angled_brackets_unescaped|unmatched_angle_brackets|unescaped_brackets_in_label|label_with_only_ws_tabs_line_endings
INVALID:destination_omitted|title_without_separation|blank_line_in_title|chars_after_title|indent_4_or_more|inside_code_block|interrupts_paragraph

### Link Reference Definitions

DEFINITION:[label]:destination|title|indent*0-3|colon|optional_ws_tabs_up_to_one_line_ending|destination|optional_ws_tabs_up_to_one_line_ending|optional_title|no_further_non_ws_char
LABEL:same_as_link_label|case_insensitive|whitespace_trimmed|max_999_chars|at_least_one_non_whitespace|no_unescaped_brackets|unicode_case_fold|internal_ws_tabs_line_endings_collapsed_to_single_space|stripped_leading_trailing_ws_tabs_line_endings
DESTINATION:same_as_link_destination|cannot_be_omitted|empty_ok_with*<>|can_contain_backslash_escapes|can_contain_entity_references
TITLE:same_as_link_title|may_extend_multiple_lines|cannot_contain_blank_line|optional|can_contain_backslash_escapes|can_contain_entity_references
SEPARATION:destination_title_separated_by_ws_tabs|up_to_one_line_ending_between_colon_and_destination|up_to_one_line_ending_between_destination_and_title|destination_title_must_be_separated_by_ws_if_both_present
PLACEMENT:before_or_after_links|no_structural_element|cannot_interrupt_paragraph|can_follow_block_elements_without_blank_line|can_follow_each_other|independent_of_whether_reference_is_used
MATCHING:first_match_wins|case_insensitive|unicode_case_fold|normalized_strings|same_as_links|matching_on_normalized_strings_not_parsed_content
INVALID:destination_omitted|title_without_separation|blank_line_in_title|chars_after_title|indent_4_or_more|inside_code_block|interrupts_paragraph

### Images

SYNTAX:like*links|difference:![description]|description_may_contain_links
IMAGE_DESCRIPTION:same_rules_as_link_text|except_links_allowed|starts_with*![
RENDERING:alt_attribute=plain_string_content|no_formatting
REFERENCE_STYLE:same_as_links|collapsed:![description][]
LABEL:case_insensitive|same_as_links
INVALID:spaces_between_brackets|same_as_links

### Code Spans

BACKTICK_STRING:1+\_backticks|not_preceded_by_backtick|not_followed_by_backtick
SPAN:backtick_string_start|backtick_string_end|equal_length
CONTENT:between_backtick_strings|normalize
NORMALIZE:line_endings_to_spaces|strip_leading_trailing_space_if_both_present|preserve_internal_spaces
PRECEDENCE:higher_than_other_inline|backslash_escapes_not_work|literal_backslashes

### Autolinks

URI_AUTOLINK:<absolute_uri>
ABSOLUTE_URI:scheme+:+zero_or_more_chars|no_ascii_control|no_space|no*<|no*>|percent_encoded_if_needed
SCHEME:2-32_chars|ascii_letter_start|ascii_letters_digits\*+.*-|case*insensitive
EMAIL_AUTOLINK:<email_address>|url=mailto:email|label_is_email_address
EMAIL_ADDRESS:html5_email_regex|case_insensitive|non_normative_regex
INVALID:spaces_in_autolink|backslash_escapes_not_work|empty\*<>|space_before_or_after_angle_brackets|no_scheme_colon|single_char_scheme

#### Extended Autolinks (GFM Extension)

EXTENDED*WWW_AUTOLINK:www.+valid_domain|no_angle_brackets|scheme_http_inserted|valid_domain_required
EXTENDED_URL_AUTOLINK:http://|https://|ftp://+valid_domain|no_angle_brackets|extended_path_validation
EXTENDED_EMAIL_AUTOLINK:email_address_pattern|no_angle_brackets|scheme_mailto_inserted|anywhere_in_text
VALID_DOMAIN:alphanumeric_underscores_hyphens|separated_by_periods|at_least_one_period|no_underscores_in_last_two_segments
EXTENDED_PATH_VALIDATION:trailing_punctuation_removed|?|!|.|,|:|\*|*|~|parentheses\*balanced|semicolon_entity_check|<\_ends_autolink
CONTEXT:start_of_line|after_whitespace|after_delimiters\*\*\*~\_(|not_after_other_chars

### Entity and Numeric Character References

ENTITY_REFERENCE:&|valid_html5_entity_name|;|trailing_semicolon_required|html5_entities_json_source
DECIMAL_NUMERIC:&#|1-7_arabic_digits|;|invalid_code_points_replaced_by_fffd|u+0000_replaced_by_fffd
HEXADECIMAL_NUMERIC:&#|X_or_x|1-6_hex_digits|;|invalid_code_points_replaced_by_fffd|u+0000_replaced_by_fffd
VALID_HTML_ENTITY:can_be_used|exceptions
NOT_RECOGNIZED:code_blocks|code_spans
CANNOT_STAND_IN:special_chars_structural_elements|emphasis_delimiters|bullet_list_markers|thematic_breaks
RECOGNIZED_IN:urls|link_titles|fenced_code_block_info_strings|any_context_except_code
PARSER_NOTES:need_not_store_unicode_vs_entity_info|parsed_as_corresponding_unicode_character
EXAMPLES:\*|&amp;|&lt;|&gt;|&#x27;|&#x2F;|&#60;|&#62;|&#35;|&#1234;|&#X22;|&#XD06;|&#xcab;
INVALID:missing_semicolon|not_html5_entity|invalid_unicode_code_point|u+0000_security_replacement

### Raw HTML

TAG_NAME:ascii*letter+[ascii_letters|digits|hyphens]{0+}
ATTRIBUTE:[ws|tabs]{0+}+[line_ending]{0,1}+attribute_name+attribute_value_spec_optional
ATTRIBUTE_NAME:[ascii_letter|*|:]+[ascii_letters|digits|*|.|:|-]{0+}
ATTRIBUTE_VALUE_SPEC:[ws|tabs]{0+}+[line_ending]{0,1}+=+[ws|tabs]{0+}+[line_ending]{0,1}+attribute_value
ATTRIBUTE_VALUE:unquoted|single_quoted|double_quoted
UNQUOTED:nonempty|no_ws|no_tabs|no_line_endings|no*"|no*'|no*=|no*<|no*>|no*`
SINGLE_QUOTED:'+[chars_no*']{0+}+'
DOUBLE_QUOTED:"+[chars_no*"]{0+}+"
OPEN_TAG:<+tag_name+attributes{0+}+[ws|tabs]{0+}+[line_ending]{0,1}+[/]{0,1}+>
CLOSING_TAG:</+tag_name+[ws|tabs]{0+}+[line_ending]{0,1}+>
HTML_COMMENT:<!-->|<!--->|<!--+[chars_no*-->]{0+}+-->
PROCESSING_INSTRUCTION:<?+[chars_no*?>]{0+}+?>
DECLARATION:<!+ascii_letter+[chars_no*>]{0+}+>
CDATA:<![CDATA[+[chars_no*]]>]{0+}+]]>
HTML_TAG:open_tag|closing_tag|html_comment|processing_instruction|declaration|cdata_section
PARSING:raw_html|not_escaped|custom_tags_allowed|entity_references_preserved_in_attributes|backslash_escapes_not_work_in_attributes

#### Disallowed Raw HTML (GFM Extension)

DISALLOWED*TAGS:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext|case_insensitive
FILTERING:replace_leading\*<\_with*&lt;|post_parsing|security_measure|unique_html_interpretation_prevented

### Line Breaks

#### Soft Line Breaks

DEFINITION:line_ending|not_hard_line_break|not_code_span|not_html_tag
RENDERING:line_ending_or_space|optional_as_hard_line_break

#### Hard Line Breaks

DEFINITION:line_ending|not_code_span|not_html_tag|preceded_by_2+\_spaces|not_end_of_block
ALTERNATIVE:backslash_before_line_ending
RENDERING:<br/>
LEADING_SPACES_IGNORED:next_line
OCCURS_IN:emphasis|links|other_inline_constructs
NOT_IN:code_spans|html_tags

## Extensions and Special Cases

### Tables (GFM Extension)

TYPE:leaf_block|gfm_extension
STRUCTURE:header_row+delimiter_row+zero_or_more_data_rows
HEADER_ROW:pipe_delimited_cells|contains_arbitrary_text|inlines_parsed
DELIMITER_ROW:hyphens_only|optional_colons_for_alignment|left(:-)|right(-:)|center(:-:)
DATA_ROWS:zero_or_more|pipe_delimited_cells|inlines_parsed
CELLS:arbitrary_text|spaces_trimmed|leading_trailing_pipes_optional|pipe_escaped_with_backslash
ALIGNMENT:left(:-)|right(-:)|center(:-:)|default(---)
REQUIREMENTS:header_must_match_delimiter_cell_count|delimiter_row_required|header_row_required
END_CONDITION:first_empty_line|beginning_of_block_level_structure
VARIABLE_CELLS:data_rows_can_have_fewer_or_more_cells|fewer_inserts_empty|more_ignores_excess
INDENT:0-3_spaces
BLOCK_LEVEL:no_block_level_elements_in_cells|inlines_only
EMPTY_TBODY:no_tbody_if_no_data_rows

### GFM vs CommonMark Differences

GFM is a strict superset of CommonMark. Extensions:

**Block-Level:**

- **Tables**: Pipe-delimited cells, header + delimiter row required, 0-3 space indent
- **Task Lists**: `[ ]` or `[x]` at start of list item content, case-insensitive

**Inline-Level:**

- **Strikethrough**: `~~text~~`, cannot nest or span lines, similar to emphasis
- **Extended Autolinks**: `www.`, bare URLs (http/https/ftp), bare emails without angle brackets

**Other:**

- **Disallowed HTML**: Security filtering of `<title>`, `<textarea>`, `<style>`, `<xmp>`, `<iframe>`, `<noembed>`, `<noframes>`, `<script>`, `<plaintext>` (leading `<` replaced with `&lt;`)
- **List Hard Breaks**: Two spaces or backslash at end of line creates `<br>` in list items

### Mega Patterns: Shared Subalgorithms

Recurring patterns across rulesets that enable parser abstractions. Grouped by phase (Block/Inline).

#### Block Phase Patterns

**1. Indentation Normalization (0-3 Spaces)**: Most blocks require 0-3 spaces before marker. 4+ → indented code. Tabs = 4 spaces. Applies to: headings, thematic breaks, fences, lists, blockquotes, HTML, tables.

**2. Container Continuation**: Containers continue if lines match prefix + required indent. Lazy continuations allow reduced indent for paragraphs only. Applies to: lists, blockquotes, indented code.

**3. Leaf Block Content**: Either parse as inlines (paragraphs, headings) or preserve literally (code blocks, HTML). Handles concatenation, whitespace normalization.

**4. Block Precedence**: When multiple blocks could start, precedence determines winner. Thematic breaks > list items; setext headings > thematic breaks; HTML types 1-6 interrupt paragraphs, type 7 does not.

**5. Delimiter-Only Lines**: Validate delimiter-only lines (thematic breaks: 3+ same char, optional spaces; setext: 1+ same char, no internal spaces).

**6. Two-Phase Parsing Strategy**: Parse block structure first (building tree of blocks), then walk tree to parse inline structure. Enables reference resolution before inline parsing.

**7. Open Block Continuation Checking**: Before creating new blocks, check if existing open blocks can continue. Each block type has continuation conditions (e.g., blockquote requires `>`, paragraph requires non-blank). Lazy continuations allow reduced markers for paragraph text only.

**8. Table Cell Splitting with Context Awareness**: Split table rows by `|` delimiter while respecting escaped pipes (`\|`) and code spans (pipes inside backticks are literal). Trim cell content, handle leading/trailing pipes optionally.

**9. Delimiter Row Validation**: Validate table delimiter rows contain only hyphens (`-`) and optional colons (`:`) for alignment. Pattern: `:?-+:?` (left: `:-`, right: `-:`, center: `:-:`, default: `---`).

**10. Variable Cell Count Normalization**: Handle mismatched cell counts in tables. Pad with empty cells if fewer, truncate excess if more. Header row cell count determines target.

**11. Task List Marker Detection**: Detect `[ ]` (unchecked) or `[x]`/`[X]` (checked) at start of list item content. Optional leading spaces, case-insensitive `x`, requires whitespace after marker before other content.

**12. Tight/Loose List Detection**: Determine if list wraps paragraphs in `<p>` tags. Loose if blank lines between items or two block elements with blank line between. Tight otherwise. Affects rendering, not parsing structure.

**13. Marker Width Calculation**: Calculate list marker width (including digits and delimiters) to determine required continuation indent. Examples: `-` = 1, `+` = 1, `*` = 1, `1.` = 2, `10)` = 3. Continuation indent = marker width + 1-4 spaces.

**14. Content Concatenation**: Join multiple lines with newlines before parsing. Used in paragraphs, headings, list items. Preserves line structure while creating single content string.

**15. Trailing Whitespace Stripping**: Strip trailing whitespace from content before inline parsing. Prevents hard line breaks from trailing spaces. Applied to paragraphs, headings, link text.

**16. Reference Definition Pre-Collection**: Collect all reference definitions in first pass before block parsing. Enables reference resolution during inline parsing. Scans for `[label]: destination` patterns, skips fenced code blocks.

#### Inline Phase Patterns

**1. Flanking Delimiter Detection**: Delimiters (`*`, `_`, `[`) are flanking based on whitespace/punctuation context. Left-flanking opens, right-flanking closes. Unicode categories used. Applies to: emphasis, links, images.

**2. Delimiter Run Processing**: Consecutive delimiters form runs. Length determines strength (odd/even rules). Applies to: emphasis, strikethrough. Cannot mix `*` and `_`; `_` not intraword.

**3. Nested Structure Resolution**: Inner constructs take precedence. Precedence: code > links/images/HTML > emphasis. First overlapping span wins; shorter span takes precedence with same closing delimiter.

**4. Escapable Character Handling**: Backslash escapes and entity references. Escapes don't work in code spans/autolinks. Entities parsed to Unicode (HTML5 only). Invalid entities → replacement character.

**5. Autolink Detection**: Basic (`<scheme:uri>`, `<email>`) and extended (www., bare URLs/emails). Domain/path validation, trailing punctuation removal, scheme requirements.

**6. Code Span Boundary Detection**: Backtick runs of equal length delimit spans. Nested backticks require longer closing runs. Whitespace normalized (leading/trailing stripped if both present).

**7. Reference Resolution**: Labels normalized (whitespace collapsed, case-insensitive), matched against definitions. Precedence: inline > full reference > collapsed > shortcut. First match wins.

**8. HTML Tag Processing**: Parse and preserve HTML tags. GFM security filtering for disallowed tags. Malformed HTML still parsed. Complex attribute parsing rules.

**9. Delimiter Stack Algorithm**: Process nested emphasis/links using delimiter stack. Push delimiters (`*`, `_`, `[`, `![`) to stack with metadata (type, count, active, open/close potential). On `]`, look for link/image; on delimiter match, process emphasis. Stack enables O(n) parsing without recursion.

**10. Label Normalization**: Normalize labels for matching (trim, collapse internal whitespace/tabs/newlines to single space, unicode case fold, strip leading/trailing whitespace). Used for link/image references, reference definitions. Enables case-insensitive matching and whitespace-tolerant matching.

**11. Unicode Category Checking**: Check Unicode character categories (whitespace Zs, punctuation P/S) for flanking detection, whitespace identification. More robust than ASCII-only checks. Used in emphasis, link parsing, whitespace detection.

**12. Context-Aware Parsing**: Some constructs parse differently based on context flags (inAnchor, inCode, inHTML). Prevents nested links, disables escapes in code spans, affects HTML parsing. Context flags set/unset during parsing.

**13. Balanced Bracket/Parenthesis Matching**: Match balanced brackets/parentheses with nesting limits (max 3 for link destinations). Respect escaped characters. Used in link destinations, autolink paths, URL validation.

**14. Optional Component Parsing**: Many constructs have optional components (titles, info strings, alignments, attributes). Parse conditionally based on presence indicators (quotes, colons, etc.). Handle missing components gracefully.
