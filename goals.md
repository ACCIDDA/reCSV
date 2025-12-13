## Goal
To build a simple chat system for users to convert csv-like data from one format to another without writing any code

### Flow
- User uploads a csv file or provides a link to the file 
- User uploads a metadata describing the data or a URL containing this info (optional)
- User provides a metadata describing the output format or a URL containing this info. By default, we use the hubverse format (hubverse-target-data.md). This can be a radio button selecting hubverse or custom
- Agent chats with the user to ensure it understand the input file format
- Agent chats with the user to ensure it understand the output file format. Hubverse format should be already clear to the Agent.
- Agent generates a file in the required output format from user's input.

### Consideration
Input/Output files may be large!
- The agent should use only the first few rows and columns of the input file in the LLM API
- Instead of generating files directly, it should generate code that would run on the input file to create the output file
- We don't want users to be able to understand the code or install too many things. Perhaps this can be done in the client's browser itself (javascript?). But how do we run dynamically generated code?
- The server should use OpenRouter API. 