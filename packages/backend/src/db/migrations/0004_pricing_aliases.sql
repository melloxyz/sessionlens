INSERT OR IGNORE INTO models (provider, model_name, input_cost_per_million, output_cost_per_million, cached_input_cost) VALUES
  ('google', 'gemini-3.1-pro-preview', 2.00, 12.00, NULL),
  ('openai', 'gpt-5.4', 1.75, 14.00, 0.875),
  ('openai', 'gpt-5.4-mini', 0.15, 0.60, 0.075),
  ('openai', 'gpt-5.5', 2.50, 20.00, 1.25),
  ('qwen', 'qwen-plus', 0.40, 1.20, NULL),
  ('qwen', 'qwen-max', 1.60, 6.40, NULL);
