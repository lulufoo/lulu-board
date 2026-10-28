-- LB-544. The web share save calls the Worker. Drop the four-argument wrapper.

drop function public.save_shared_graph(text, text, text, integer);
