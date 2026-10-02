"""Site settings and the GATE CSE syllabus library.

Books and chapters follow the official GATE 2027 CS syllabus. To add or edit
a chapter, change it here and run scripts/build_library.py again (it only
writes what is missing).
"""

SITE_NAME = "inkwand"
TAGLINE = "Free GATE CSE notes, practice papers and flashcards."
FOOTER_LINE = "Built for every self-taught student"

# Footer links. Replace with your real URLs.
GITHUB_URL = "https://github.com/pyarchana/inkwand"
DEV_POST_URL = "https://dev.to/your-username"

MCQS_PER_PAPER = 5
FLASHCARDS_PER_DECK = 8
STARS_PER_CORRECT = 1

# Shelves are just groups on the bookshelf, top to bottom.
SHELVES = [
    {"id": "maths", "title": "Engineering Mathematics"},
    {"id": "core", "title": "Core Computer Science"},
    {"id": "systems", "title": "Systems"},
]

# Each chapter: (id, title, what the syllabus covers). The scope text is sent
# to the model so it stays inside the GATE syllabus.
BOOKS = [
    {
        "id": "discrete-math", "shelf": "maths", "title": "Discrete Mathematics",
        "short": "Discrete Math", "color": "#e07a5f",
        "chapters": [
            ("logic", "Propositional and First Order Logic", "propositional logic, first order logic, quantifiers, validity, inference"),
            ("sets-relations-functions", "Sets, Relations and Functions", "sets, relations and their properties, equivalence relations, functions"),
            ("posets-lattices", "Partial Orders and Lattices", "partial orders, Hasse diagrams, lattices"),
            ("monoids-groups", "Monoids and Groups", "semigroups, monoids, groups, subgroups"),
            ("graph-theory", "Graphs: Connectivity, Matching, Colouring", "graph connectivity, matching, graph colouring"),
            ("counting", "Combinatorics: Counting", "permutations, combinations, pigeonhole principle, inclusion exclusion"),
            ("recurrences", "Recurrence Relations and Generating Functions", "solving recurrence relations, generating functions"),
        ],
    },
    {
        "id": "linear-algebra", "shelf": "maths", "title": "Linear Algebra",
        "short": "Linear Algebra", "color": "#3d85c6",
        "chapters": [
            ("matrices-determinants", "Matrices and Determinants", "matrix operations, rank, determinants and their properties"),
            ("linear-systems", "Systems of Linear Equations", "consistency, unique and infinite solutions, Gaussian elimination"),
            ("eigen", "Eigenvalues and Eigenvectors", "eigenvalues, eigenvectors, characteristic equation, properties"),
            ("lu", "LU Decomposition", "LU decomposition of a matrix"),
        ],
    },
    {
        "id": "calculus", "shelf": "maths", "title": "Calculus",
        "short": "Calculus", "color": "#6aa84f",
        "chapters": [
            ("limits-continuity", "Limits, Continuity and Differentiability", "limits, continuity, differentiability"),
            ("maxima-minima", "Maxima and Minima", "local and global maxima and minima"),
            ("mvt", "Mean Value Theorem", "Rolle's theorem, Lagrange mean value theorem"),
            ("integration", "Integration", "definite and indefinite integration"),
        ],
    },
    {
        "id": "probability", "shelf": "maths", "title": "Probability and Statistics",
        "short": "Probability", "color": "#8e7cc3",
        "chapters": [
            ("random-variables", "Random Variables", "discrete and continuous random variables, expectation, variance"),
            ("continuous-distributions", "Uniform, Normal and Exponential Distributions", "uniform, normal and exponential distributions"),
            ("discrete-distributions", "Poisson and Binomial Distributions", "Poisson and binomial distributions"),
            ("descriptive-stats", "Mean, Median, Mode and Standard Deviation", "mean, median, mode, standard deviation"),
            ("conditional-bayes", "Conditional Probability and Bayes Theorem", "conditional probability, total probability, Bayes theorem"),
        ],
    },
    {
        "id": "digital-logic", "shelf": "core", "title": "Digital Logic",
        "short": "Digital Logic", "color": "#f1c232",
        "chapters": [
            ("boolean-algebra", "Boolean Algebra and Algebraic Minimization", "boolean algebra laws, algebraic minimization"),
            ("kmap", "Karnaugh Maps", "K-map minimization, don't cares, prime implicants"),
            ("tabular-method", "Tabular (Quine-McCluskey) Method", "tabular method of minimization"),
            ("combinational", "Combinational Circuits", "adders, multiplexers, decoders, encoders"),
            ("sequential", "Sequential Circuits", "latches, flip-flops, counters, registers"),
            ("number-representation", "Number Representation and Arithmetic", "number systems, signed representations, fixed and floating point (IEEE 754) arithmetic"),
        ],
    },
    {
        "id": "coa", "shelf": "core", "title": "Computer Organization and Architecture",
        "short": "COA", "color": "#c27ba0",
        "chapters": [
            ("isa-addressing", "Instruction Set and Addressing Modes", "instruction formats, addressing modes"),
            ("alu", "Design of the ALU", "arithmetic and logic unit design"),
            ("control-unit", "Control Unit: Hardwired and Microprogrammed", "hardwired and microprogrammed control units"),
            ("memory-hierarchy", "Memory Interfacing and Hierarchy", "memory hierarchy, performance, average access time"),
            ("cache", "Cache Memory Mapping", "direct, associative and set associative mapping, address breakdown"),
            ("io", "I/O Interface: Interrupts and DMA", "interrupt driven I/O, DMA"),
            ("pipelining", "Instruction Pipelining and Hazards", "pipelining, speedup, structural, data and control hazards"),
        ],
    },
    {
        "id": "pds", "shelf": "core", "title": "Programming and Data Structures",
        "short": "Prog & DS", "color": "#45818e",
        "chapters": [
            ("c-programming", "Programming in C", "C pointers, arrays, scope, parameter passing, output tracing"),
            ("recursion", "Recursion", "recursive functions and tracing"),
            ("arrays", "Arrays", "arrays, address calculation, row and column major"),
            ("stacks-queues", "Stacks and Queues", "stacks, queues, infix postfix conversion"),
            ("linked-lists", "Linked Lists", "singly, doubly and circular linked lists"),
            ("trees-bst", "Trees and Binary Search Trees", "binary trees, traversals, binary search trees"),
            ("heaps", "Binary Heaps", "binary heaps, heapify, heap operations"),
            ("graphs-ds", "Graphs as Data Structures", "graph representations: adjacency matrix and list"),
        ],
    },
    {
        "id": "algorithms", "shelf": "core", "title": "Algorithms",
        "short": "Algorithms", "color": "#cc4125",
        "chapters": [
            ("searching", "Searching", "linear and binary search"),
            ("sorting", "Sorting", "comparison sorts, their complexity and stability"),
            ("hashing", "Hashing", "hash functions, collision resolution, load factor"),
            ("asymptotic", "Asymptotic Complexity", "big O, omega, theta, worst case time and space complexity"),
            ("greedy", "Greedy Algorithms", "greedy technique, Huffman coding, activity selection, fractional knapsack"),
            ("dynamic-programming", "Dynamic Programming", "dynamic programming, LCS, 0/1 knapsack, matrix chain"),
            ("divide-conquer", "Divide and Conquer", "divide and conquer, recurrences, master theorem"),
            ("graph-traversals", "Graph Traversals", "BFS, DFS, topological sort"),
            ("mst", "Minimum Spanning Trees", "Kruskal and Prim algorithms"),
            ("shortest-paths", "Shortest Paths", "Dijkstra, Bellman Ford, Floyd Warshall"),
        ],
    },
    {
        "id": "toc", "shelf": "core", "title": "Theory of Computation",
        "short": "TOC", "color": "#674ea7",
        "chapters": [
            ("regex-fa", "Regular Expressions and Finite Automata", "regular expressions, DFA, NFA, minimization"),
            ("cfg-pda", "Context-Free Grammars and Push-Down Automata", "CFGs, PDAs, ambiguity"),
            ("regular-cfl", "Regular and Context-Free Languages", "closure properties of regular and context-free languages"),
            ("pumping-lemma", "Pumping Lemma", "pumping lemma for regular and context-free languages"),
            ("turing-undecidability", "Turing Machines and Undecidability", "Turing machines, decidability, undecidable problems"),
        ],
    },
    {
        "id": "compiler", "shelf": "core", "title": "Compiler Design",
        "short": "Compilers", "color": "#b45f06",
        "chapters": [
            ("lexical", "Lexical Analysis", "tokens, lexemes, lexical analyzer"),
            ("parsing", "Parsing", "FIRST and FOLLOW, LL(1), LR(0), SLR, LALR, CLR parsing"),
            ("sdt", "Syntax-Directed Translation", "SDDs, S-attributed and L-attributed definitions"),
            ("runtime", "Runtime Environments", "activation records, stack allocation, parameter passing"),
            ("icg", "Intermediate Code Generation", "three address code, quadruples, triples"),
            ("local-optimisation", "Local Optimisation", "basic blocks, DAGs, local optimisation"),
            ("data-flow", "Data Flow Analysis", "constant propagation, liveness analysis, common subexpression elimination"),
        ],
    },
    {
        "id": "os", "shelf": "systems", "title": "Operating Systems",
        "short": "OS", "color": "#e69138",
        "chapters": [
            ("syscalls-processes", "System Calls and Processes", "system calls, process states, fork"),
            ("threads", "Threads", "user and kernel threads"),
            ("ipc", "Inter-Process Communication", "shared memory, message passing"),
            ("synchronization", "Concurrency and Synchronization", "critical section, semaphores, mutex, classical problems"),
            ("deadlock", "Deadlock", "deadlock conditions, prevention, avoidance, Banker's algorithm, detection"),
            ("scheduling", "CPU and I/O Scheduling", "FCFS, SJF, SRTF, round robin, priority, disk scheduling"),
            ("memory-management", "Memory Management", "contiguous allocation, paging, segmentation"),
            ("virtual-memory", "Virtual Memory", "demand paging, page replacement, TLB, thrashing"),
            ("file-systems", "File Systems", "file allocation methods, directory structure, inodes"),
        ],
    },
    {
        "id": "dbms", "shelf": "systems", "title": "Databases",
        "short": "DBMS", "color": "#0b5394",
        "chapters": [
            ("er-model", "ER Model", "entities, relationships, cardinality, ER to relational mapping"),
            ("relational-algebra", "Relational Algebra and Tuple Calculus", "relational algebra operators, tuple relational calculus"),
            ("sql", "SQL", "SQL queries, joins, aggregation, nested queries"),
            ("normal-forms", "Integrity Constraints and Normal Forms", "keys, functional dependencies, 1NF to BCNF, decomposition"),
            ("indexing", "File Organization and Indexing", "file organization, B trees, B+ trees, index calculations"),
            ("transactions", "Transactions and Concurrency Control", "ACID, schedules, serializability, locking, timestamp protocols"),
        ],
    },
    {
        "id": "cn", "shelf": "systems", "title": "Computer Networks",
        "short": "Networks", "color": "#38761d",
        "chapters": [
            ("layering", "Principles of Layering", "OSI and TCP/IP layering"),
            ("switching", "Switching and Performance Metrics", "circuit, packet and virtual circuit switching, delay, throughput"),
            ("error-detection", "Data Link Layer: Error Detection", "parity, checksum, CRC"),
            ("mac-ethernet", "Medium Access Control and Ethernet", "ALOHA, CSMA/CD, Ethernet"),
            ("routing", "Distance Vector and Link State Routing", "distance vector, link state routing, count to infinity"),
            ("ipv4", "IPv4: Fragmentation, CIDR and NAT", "IPv4 fragmentation, CIDR, subnetting, NAT"),
            ("tcp", "TCP: Flow and Congestion Control, Sockets", "TCP flow control, congestion control, socket API"),
            ("dns-http", "DNS and HTTP", "DNS resolution, HTTP"),
        ],
    },
]


def _build_indexes():
    books = {}
    chapters = {}
    for book in BOOKS:
        books[book["id"]] = book
        for cid, title, scope in book["chapters"]:
            chapters[(book["id"], cid)] = {"id": cid, "title": title, "scope": scope}
    return books, chapters


BOOKS_BY_ID, CHAPTERS = _build_indexes()


def public_config() -> dict:
    """What the frontend needs to draw the shelf."""
    return {
        "site_name": SITE_NAME,
        "tagline": TAGLINE,
        "footer_line": FOOTER_LINE,
        "github_url": GITHUB_URL,
        "dev_post_url": DEV_POST_URL,
        "stars_per_correct": STARS_PER_CORRECT,
        "shelves": SHELVES,
        "books": [
            {
                "id": b["id"], "shelf": b["shelf"], "title": b["title"],
                "short": b["short"], "color": b["color"],
                "chapters": [{"id": c[0], "title": c[1]} for c in b["chapters"]],
            }
            for b in BOOKS
        ],
    }
