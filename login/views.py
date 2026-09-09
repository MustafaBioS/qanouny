from django.shortcuts import render

# Create your views here.

def login(request):
    if request.method == "POST":
        print(request.POST)

    return render(request, "login/login.html")

def signup(request):
    return render(request, "login/signup.html")
