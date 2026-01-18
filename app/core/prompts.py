import os


def get_system_prompt() -> str:
    """Load system prompt from file."""
    prompt_path = os.path.join(os.path.dirname(__file__), "../../prompts/system_prompt.txt")

    with open(prompt_path, "r") as f:
        return f.read()
